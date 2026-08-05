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
import {ActivityFeedEntry , ActivityFeedEntryDocument} from '../schemas/activity-feed-entry.schema'
import { Model } from 'mongoose';
import { OutboxProcessor } from '../../outbox/services/outbox.processor';
import { NotificationGateway } from '../../websocket/notification.gateway';
import { formatActivityMessage } from './format-activity-message';
import { RulesCache } from '../../rule-engine/services/rules-cache';

const CONSUMER_GROUP = 'activity-feed';
const CONSUMER_NAME = `process-${process.pid}`;
const READ_COUNT = 10;
const BLOCK_MS = 5000;

type StreamMessage = { id: string; fields: Record<string, string> };

@Injectable()
export class ActivityFeedConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ActivityFeedConsumer.name);
  private running: boolean = false;

  constructor(
    @Inject(REDIS_STREAM_CLIENT) private readonly redis: Redis,
    @InjectModel(ActivityFeedEntry.name)
    private readonly activityModel: Model<ActivityFeedEntryDocument>,
    private readonly outboxProcessor: OutboxProcessor,
    private readonly notificationGateway : NotificationGateway,
    private readonly rulesCache: RulesCache,
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
      try {
        const messages = await this.readNextBatch();
        for (const message of messages) {
          await this.handle(message);
        }
      } catch (error) {
        this.logger.error(
          'activity feed consumer read loop failed',
          error instanceof Error ? error.stack : String(error),
        );
        await this.ensureConsumerGroup();
        await this.outboxProcessor.replayRecent();
      }
    }
  }

  private async handle(message: StreamMessage) {
    const { eventType  , eventId} = message.fields;
    const payload = message.fields.payload ? JSON.parse(message.fields.payload) : {};
    const messageText = formatActivityMessage(eventType , payload);
    if(messageText && payload.employeeId) {

      await this.activityModel.updateOne(
        {_id: eventId},
        {$set: {employeeId : payload.employeeId , eventType ,  occurredOn : new Date(message.fields.occurredOn) , payload , message : messageText}},
        {upsert : true}
      )

      if(eventType === "MissionAssigned") {
        console.log("emitting mission assigned to user : " + payload.employeeId);
        // Whether completing this mission will actually grant XP — derived
        // from the live rule graph (MissionCompleted -> GrantXP wiring), not
        // a mission-catalog field, since it's admin-configurable and can
        // change independently of the mission itself.
        const xpStatus = this.rulesCache
          .get('MissionCompleted')
          .some((rule) => rule.action === 'GrantXP');
        this.notificationGateway.emitToEmployee(payload.employeeId , 'mission:assigned' , {
          id: payload.assignmentId,
          deadline: payload.deadline ?? null,
          xpStatus,
          mission : {
            name: payload.missionName,
            xpGranted : payload.xpGranted,
            durationDays: payload.durationDays
          }
        })
      }

      this.notificationGateway.emitToEmployee(payload.employeeId, 'activity:new' , {
        id: eventId , eventType , message: messageText , occurredOn: message.fields.occurredOn
      })

    }
    await this.redis.xack(EVENT_STREAM, CONSUMER_GROUP, message.id);
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
