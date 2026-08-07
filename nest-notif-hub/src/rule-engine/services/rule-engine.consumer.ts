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
import {
  REDIS_STREAM_CLIENT,
  EVENT_STREAM,
} from '../../shared/redis/redis.constants';
import { ProcessedEventsEntity } from '../entities/processed-events.entity';
import { ActionRegistry } from '../actions/action-registry';
import { ActionResult } from '../actions/action.interface';
import { EventLinkEntity } from '../entities/event-link.entity';
import { OutboxRepository } from '../../outbox/repositories/outbox.repository';
import { RulesCache } from './rules-cache';
import { OutboxProcessor } from '../../outbox/services/outbox.processor';

const CONSUMER_GROUP = 'rule-engine';
const READ_COUNT = 10;
const BLOCK_MS = 5000;
// Concurrent internal readers on the same consumer group — Redis Streams
// groups are built for exactly this: each gets a distinct share of
// incoming messages. Without this, a burst of heavy events (e.g. several
// MissionCompleted cascades, each several sequential transactions deep)
// head-of-line-blocks anything queued behind them, even something as
// cheap as a single MissionAssigned — one worker stays busy grinding
// through the cascade while a free worker could have picked up the light
// one immediately. 3 is a modest default, not maximal — see the
// connectionLimit bump in app.module.ts for why this isn't set higher
// without also revisiting that.
const WORKER_COUNT = 3;

type StreamMessage = { id: string; fields: Record<string, string> };

@Injectable()
export class RuleEngineConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RuleEngineConsumer.name);
  private running = false;
  private workerConnections: Redis[] = [];

  constructor(
    @Inject(REDIS_STREAM_CLIENT) private readonly redis: Redis,
    private readonly rulesCache: RulesCache,
    @InjectRepository(ProcessedEventsEntity)
    private readonly processedEventRepo: Repository<ProcessedEventsEntity>,
    private readonly actionRegistry: ActionRegistry,
    private readonly outboxRepository: OutboxRepository,
    private readonly outboxProcessor: OutboxProcessor,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.ensureConsumerGroup();
    this.running = true;
    // Each worker gets its own dedicated connection, not a shared one —
    // XREADGROUP...BLOCK occupies whatever connection it's issued on
    // until a message arrives, so N workers sharing one connection would
    // just serialize against each other, defeating the entire point.
    // Same reasoning that already justifies REDIS_STREAM_CLIENT being
    // separate from REDIS_CLIENT elsewhere in this app.
    for (let i = 0; i < WORKER_COUNT; i++) {
      const connection = this.redis.duplicate();
      this.workerConnections.push(connection);
      // Deliberately not awaited — each runs for the lifetime of the app.
      this.loop(connection, `consumer-${process.pid}-${i}`);
    }
  }

  async onModuleDestroy() {
    this.running = false;
    await Promise.all(
      this.workerConnections.map((connection) => connection.quit()),
    );
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

  private async loop(connection: Redis, consumerName: string) {
    while (this.running) {
      let messages: StreamMessage[];
      try {
        messages = await this.readNextBatch(connection, consumerName);
      } catch (error) {
        // A read-level failure is the genuine "stream/group might be
        // lost" case replayRecent() exists for (NOGROUP after a
        // flush/restart, or a real connection error) — recover the same
        // way every consumer in this app does.
        this.logger.error(
          'Rule engine read loop failed',
          error instanceof Error ? error.stack : String(error),
        );
        await this.ensureConsumerGroup();
        await this.outboxProcessor.replayRecent();
        continue;
      }

      // Message-level failures are handled entirely inside handle() —
      // never here. A message/rule that can never succeed (bad or
      // missing referenced data, a bug) must never be able to trigger a
      // stream-wide replay: confirmed the hard way that a single event
      // referencing a deleted employee looped replayRecent() forever,
      // since every replay just resent the same unfixable message.
      // Messages in a batch are also unrelated events touching unrelated
      // rows, so there's no reason one has to fully finish before the
      // next even starts — allSettled runs them concurrently.
      await Promise.allSettled(
        messages.map((message) => this.handle(connection, message)),
      );
    }
  }

  private async readNextBatch(
    connection: Redis,
    consumerName: string,
  ): Promise<StreamMessage[]> {
    const result = await connection.xreadgroup(
      'GROUP',
      CONSUMER_GROUP,
      consumerName,
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

  private async handle(connection: Redis, message: StreamMessage) {
    const { eventId, eventType, correlationId, aggregateType, aggregateId } =
      message.fields;

    const rules = this.rulesCache.get(eventType);
    this.logger.log(`${eventType} (${eventId}): ${rules.length} rule(s) found`);

    const payload = message.fields.payload
      ? JSON.parse(message.fields.payload)
      : {};

    // Each rule is applied and marked done independently, and — like the
    // messages above — has no reason to wait on any other rule for the
    // same event: they touch unrelated rows (e.g. ScheduleReminder writes
    // scheduled_reminders, Notify writes in_app_notifications). One rule
    // failing (or having already run on a prior delivery) must never
    // block or re-trigger the others — see [[per-rule-idempotency]].
    const results = await Promise.allSettled(
      rules.map((rule) =>
        this.processRule(
          eventId,
          eventType,
          correlationId,
          aggregateType,
          aggregateId,
          payload,
          rule,
        ),
      ),
    );
    const failures = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (failures.length > 0) {
      // A genuine, non-transient processing failure — never trigger a
      // stream-wide replay for this, it would just retry the exact same
      // unfixable failure forever. Leave this message unacked instead:
      // it stays quarantined in this consumer's pending-entries list for
      // manual inspection (XPENDING/XCLAIM), rather than either silently
      // disappearing or taking the whole pipeline down with it.
      for (const failure of failures) {
        this.logger.error(
          `${eventType} (${eventId}): rule processing failed, leaving message unacked`,
          failure.reason instanceof Error
            ? failure.reason.stack
            : String(failure.reason),
        );
      }
      return;
    }

    await connection.xack(EVENT_STREAM, CONSUMER_GROUP, message.id);
  }

  private async processRule(
    eventId: string,
    eventType: string,
    correlationId: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, any>,
    rule: EventLinkEntity,
  ): Promise<void> {
    const alreadyDone = await this.processedEventRepo.exists({
      where: { consumerGroup: CONSUMER_GROUP, eventId, ruleId: rule.id },
    });
    if (alreadyDone) {
      this.logger.log(
        `${eventType} (${eventId}): rule ${rule.id} already applied, skipping`,
      );
      return;
    }

    const action = this.actionRegistry.get(rule.action);
    // Local to this rule's own call — was previously a `let` shared across
    // every iteration of a sequential loop, which would have been a real
    // race now that rules run concurrently.
    let result: ActionResult;

    try {
      // The action's own work (if it's MySQL-only, e.g. GrantXP), the
      // emitted outbox row, and the dedupe mark all commit together or
      // not at all. A crash anywhere in here leaves zero trace, so a
      // retry safely redoes the whole rule exactly once — no orphaned
      // child event, and no double-applied XP grant either.
      //
      // Actions with a non-MySQL side effect (NotifyAction's email/sms
      // channels enqueuing to BullMQ) don't get this guarantee from the
      // transaction — they need their own idempotency (a deterministic
      // job ID), since a Redis write can't roll back with MySQL.
      await this.dataSource.transaction(async (manager) => {
        result = await action.execute(payload, rule.params, {
          manager,
          eventId,
          eventType,
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

      // Unconditional — not just the shouldEmit/targetEvent chain case.
      // An action can write its own outbox row as a side effect without
      // this consumer knowing about it (e.g. NotifyAction's own
      // NotificationDelivered tracking write) — a wake with nothing
      // pending is a cheap no-op, so this is the simplest way to
      // guarantee every outbox row from this transaction gets drained
      // promptly, not only the chained-event case.
      await this.outboxRepository.notifyWake();
      if (result!.shouldEmit && rule.targetEvent) {
        this.logger.log(
          `${eventType} -> ${rule.targetEvent} emitted (caused by ${eventId})`,
        );
      }
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        // Something else completed this exact (event, rule) concurrently
        // — the transaction rolled back everything we did, so no
        // duplicate or partial work remains. Expected and common now that
        // rules/messages genuinely run in parallel, not just a rare
        // replay-collision case.
        this.logger.warn(
          `${eventType} (${eventId}): rule ${rule.id} completed concurrently, skipping`,
        );
        return;
      }
      throw error;
    }
  }
}
