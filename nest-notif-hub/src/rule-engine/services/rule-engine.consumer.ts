import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { REDIS_STREAM_CLIENT, EVENT_STREAM } from '../../shared/redis/redis.constants';
import { ProcessedEventsEntity } from '../entities/processed-events.entity';
import { ActionRegistry } from '../actions/action-registry';
import { ActionResult } from '../actions/action.interface';
import { OutboxRepository } from '../../outbox/repositories/outbox.repository';
import { RulesCache } from './rules-cache';
import { OutboxProcessor } from '../../outbox/services/outbox.processor';

const CONSUMER_GROUP = 'rule-engine';
const CONSUMER_NAME = `consumer-${process.pid}`;
const READ_COUNT = 10;
const BLOCK_MS = 5000;

type StreamMessage = { id: string; fields: Record<string, string> };

@Injectable()
export class RuleEngineConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RuleEngineConsumer.name);
  private running = false;

  constructor(
    @Inject(REDIS_STREAM_CLIENT) private readonly redis: Redis,
    private readonly rulesCache: RulesCache,
    @InjectRepository(ProcessedEventsEntity)
    private readonly processedEventRepo: Repository<ProcessedEventsEntity>,
    private readonly actionRegistry: ActionRegistry,
    private readonly outboxRepository: OutboxRepository,
    private readonly outboxProcessor : OutboxProcessor,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.ensureConsumerGroup();
    this.running = true;
    // Deliberately not awaited — this runs for the lifetime of the app.
    this.loop();
  }

  onModuleDestroy() {
    this.running = false;
  }

  private async ensureConsumerGroup() {
    try {
      await this.redis.xgroup(
        'CREATE',
        EVENT_STREAM,
        CONSUMER_GROUP,
        '0',
        'MKSTREAM',
      );
      this.logger.log(`Consumer group "${CONSUMER_GROUP}" created`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('BUSYGROUP')) {
        // Already set up from a previous run — nothing to do.
        return;
      }
      throw error;
    }
  }

  private async loop() {
    while (this.running) {
      try {
        const messages = await this.readNextBatch();
        for (const message of messages) {
          await this.handle(message);
        }
      } catch (error) {
        this.logger.error(
          'Rule engine read loop failed',
          error instanceof Error ? error.stack : String(error),
        );
        await this.ensureConsumerGroup();
        await this.outboxProcessor.replayRecent();
      }
    }
  }

  private async readNextBatch(): Promise<StreamMessage[]> {
    const result = await this.redis.xreadgroup(
      'GROUP',
      CONSUMER_GROUP,
      CONSUMER_NAME,
      'COUNT',
      READ_COUNT,
      'BLOCK',
      BLOCK_MS,
      'STREAMS',
      EVENT_STREAM,
      '>',
    );

    if (!result) return [];

    // ioredis shape: [ [ streamName, [ [ id, flatFields ], ... ] ] ]
    const [, entries] = (result as any)[0];
    return entries.map(([id, flatFields]: [string, string[]]) => ({
      id,
      fields: this.toFieldMap(flatFields),
    }));
  }

  private toFieldMap(flat: string[]): Record<string, string> {
    const fields: Record<string, string> = {};
    for (let i = 0; i < flat.length; i += 2) {
      fields[flat[i]] = flat[i + 1];
    }
    return fields;
  }

  private async handle(message: StreamMessage) {
    const { eventId, eventType, correlationId, aggregateType, aggregateId } =
      message.fields;

    const rules = this.rulesCache.get(eventType);
    this.logger.log(`${eventType} (${eventId}): ${rules.length} rule(s) found`);

    const payload = message.fields.payload
      ? JSON.parse(message.fields.payload)
      : {};

    // Each rule is applied and marked done independently. One rule failing
    // (or having already run on a prior delivery) must never block or
    // re-trigger the others — see [[per-rule-idempotency]].
    for (const rule of rules) {
      const alreadyDone = await this.processedEventRepo.exists({
        where: { consumerGroup: CONSUMER_GROUP, eventId, ruleId: rule.id },
      });
      if (alreadyDone) {
        this.logger.log(`${eventType} (${eventId}): rule ${rule.id} already applied, skipping`);
        continue;
      }

      const action = this.actionRegistry.get(rule.action);
      let result: ActionResult;

      try {
        // The action's own work (if it's MySQL-only, e.g. GrantXP), the
        // emitted outbox row, and the dedupe mark all commit together or
        // not at all. A crash anywhere in here leaves zero trace, so a
        // retry safely redoes the whole rule exactly once — no orphaned
        // child event, and no double-applied XP grant either.
        //
        // Actions with a non-MySQL side effect (a future NotifyAction
        // enqueuing to BullMQ) don't get this guarantee from the
        // transaction — they need their own idempotency (a deterministic
        // job ID), since a Redis write can't roll back with MySQL.
        await this.dataSource.transaction(async (manager) => {
          result = await action.execute(payload, rule.params, {
            manager,
            eventId,
            ruleId: rule.id,
            correlationId,
          });

          if (result.shouldEmit && rule.targetEvent) {
            await this.outboxRepository.create(manager, {
              eventType: rule.targetEvent,
              eventId: randomUUID(),
              correlationId,
              // The event that triggered this rule becomes the parent of
              // the one it emits — this is the whole "sub-event" mechanism.
              causationId: eventId,
              aggregateType: aggregateType || null,
              aggregateId: aggregateId || null,
              occurredOn: new Date(),
              payload: result.payload ?? payload,
            });
          }
          await manager.insert(ProcessedEventsEntity, {
            consumerGroup: CONSUMER_GROUP,
            eventId,
            ruleId: rule.id,
          });
        });

        if (result!.shouldEmit && rule.targetEvent) {
          await this.outboxRepository.notifyWake();
          this.logger.log(
            `${eventType} -> ${rule.targetEvent} emitted (caused by ${eventId})`,
          );
        }
      } catch (error: any) {
        if (error?.code === 'ER_DUP_ENTRY') {
          // Something else completed this exact (event, rule) between our
          // check above and this write — the transaction rolled back
          // everything we did, so no duplicate or partial work remains.
          this.logger.warn(
            `${eventType} (${eventId}): rule ${rule.id} completed concurrently, skipping`,
          );
          continue;
        }
        throw error;
      }
    }

    await this.redis.xack(EVENT_STREAM, CONSUMER_GROUP, message.id);
  }
}
