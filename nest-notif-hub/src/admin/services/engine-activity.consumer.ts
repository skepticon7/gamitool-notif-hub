import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  EVENT_STREAM,
  REDIS_STREAM_CLIENT,
} from '../../shared/redis/redis.constants';
import Redis from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxProcessor } from '../../outbox/services/outbox.processor';
import { NotificationGateway } from '../../websocket/notification.gateway';
import { formatEngineActivityMessage } from './format-engine-activity-message';
import { EmployeeUserEntity } from '../../users/entities/employee-user.entity';

const CONSUMER_GROUP = 'engine-activity';
const CONSUMER_NAME = `process-${process.pid}`;
const READ_COUNT = 10;
const BLOCK_MS = 5000;

type StreamMessage = { id: string; fields: Record<string, string> };

@Injectable()
export class EngineActivityConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EngineActivityConsumer.name);
  private running: boolean = false;

  constructor(
    @Inject(REDIS_STREAM_CLIENT) private readonly redis: Redis,
    private readonly outboxProcessor: OutboxProcessor,
    private readonly notificationGateway: NotificationGateway,
    @InjectRepository(EmployeeUserEntity)
    private readonly employeeRepository: Repository<EmployeeUserEntity>,
  ) {}

  async onModuleInit() {
    await this.ensureConsumerGroup();
    this.running = true;
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
        return;
      }
      throw error;
    }
  }

  private async loop() {
    while (this.running) {
      let messages: StreamMessage[];
      try {
        messages = await this.readNextBatch();
      } catch (error) {
        // A read-level failure is the genuine "stream/group might be
        // lost" case replayRecent() exists for — a message-processing
        // failure (handled inside handle() now) must never trigger this,
        // or a single unfixable message would replay forever.
        this.logger.error(
          'engine activity consumer read loop failed',
          error instanceof Error ? error.stack : String(error),
        );
        await this.ensureConsumerGroup();
        await this.outboxProcessor.replayRecent();
        continue;
      }
      for (const message of messages) {
        await this.handle(message);
      }
    }
  }

  private async handle(message: StreamMessage) {
    const { eventType } = message.fields;
    try {
      const payload = message.fields.payload
        ? JSON.parse(message.fields.payload)
        : {};
      const employee = payload.employeeId
        ? await this.employeeRepository.findOneBy({ id: payload.employeeId })
        : null;

      this.notificationGateway.broadcastToAdmins('engine-activity:new', {
        eventType,
        message: formatEngineActivityMessage(
          eventType,
          payload,
          employee?.name,
        ),
        occurredOn: message.fields.occurredOn,
      });

      await this.redis.xack(EVENT_STREAM, CONSUMER_GROUP, message.id);
    } catch (error) {
      // A genuine, non-transient processing failure — never trigger a
      // stream-wide replay for this. Leave this message unacked instead:
      // quarantined, not retried automatically.
      this.logger.error(
        `${eventType}: message processing failed, leaving unacked`,
        error instanceof Error ? error.stack : String(error),
      );
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
}
