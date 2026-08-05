import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EVENT_STREAM, REDIS_STREAM_CLIENT } from '../../shared/redis/redis.constants';
import Redis from 'ioredis';
import { InjectModel } from '@nestjs/mongoose';
import {
  EmployeeProjection,
  EmployeeProjectionDocument,
} from '../schemas/employee-projection.schema';
import { Model } from 'mongoose';
import { OutboxProcessor } from '../../outbox/services/outbox.processor';

const CONSUMER_GROUP = 'employees-projection'
const CONSUMER_NAME = `process-${process.pid}`;
const READ_COUNT = 10;
const BLOCK_MS = 5000;

type StreamMessage = { id: string; fields: Record<string, string> };


@Injectable()
export class EmployeeProjectionConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EmployeeProjectionConsumer.name);
  private running: boolean = false;

  constructor(
    @Inject(REDIS_STREAM_CLIENT) private readonly redis: Redis,
    @InjectModel(EmployeeProjection.name)
    private readonly employeeModel: Model<EmployeeProjectionDocument>,
    private readonly outboxProcessor: OutboxProcessor,
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
    while(this.running) {
      try {
        const messages = await this.readNextBatch();
        for(const message of messages) {
          await this.handle(message);
        }
      }catch (error) {
        this.logger.error(
          'employees projection consumer read loop failed',
          error instanceof Error ? error.stack : String(error),
        );
        await this.ensureConsumerGroup();
        await this.outboxProcessor.replayRecent();
      }
    }
  }

  private async handle(message: StreamMessage) {
    const { eventType } = message.fields;
    const payload = message.fields.payload ? JSON.parse(message.fields.payload) : {};
    switch (eventType) {
      case 'XPGranted':
        await this.employeeModel.updateOne(
          { _id: payload.employeeId },
          { $set: { xp: payload.xp } },
          { upsert: true },
        );
        break;
      case 'LevelUp':
        await this.employeeModel.updateOne(
          { _id: payload.employeeId },
          { $set: { level: payload.newLevel } },
          { upsert: true },
        );
        break;
      default:
        // Not an event this projection cares about — normal, expected,
        // happens for every MissionCompleted/MissionAssigned/etc. flowing
        // through the same shared stream. Not an error condition.
        break;
    }
    await this.redis.xack(EVENT_STREAM , CONSUMER_GROUP , message.id);
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