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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MissionAssignmentEntity } from '../../missions/entities/mission-assignment.entity';
import { AssignmentDto } from '../../missions/dto/assignments.dto';

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
    @InjectRepository(MissionAssignmentEntity)
    private readonly assignmentRepo: Repository<MissionAssignmentEntity>,
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

      // OutboxProcessor.replayRecent() re-XADDs every outbox row from the
      // last 24h as brand-new stream entries any time a consumer self-heals
      // from NOGROUP — so this exact event can legitimately arrive here
      // more than once. The Mongo upsert below is already safe on replay
      // (same _id: eventId), but nothing emitted over the socket has any
      // dedup of its own — a naive frontend counter incrementing/
      // decrementing on mission:assigned/completed/expired would double
      // count on every replay. Checking whether this eventId was already
      // recorded BEFORE emitting is what stops that — mirrors the
      // protection RuleEngineConsumer already gets from processed_events.
      const alreadyRecorded = await this.activityModel.exists({ _id: eventId });

      await this.activityModel.updateOne(
        {_id: eventId},
        {$set: {employeeId : payload.employeeId , eventType ,  occurredOn : new Date(message.fields.occurredOn) , payload , message : messageText}},
        {upsert : true}
      )

      if (alreadyRecorded) {
        await this.redis.xack(EVENT_STREAM, CONSUMER_GROUP, message.id);
        return;
      }

      if(eventType === "MissionAssigned") {
        console.log("emitting mission assigned to user : " + payload.employeeId);
        this.notificationGateway.emitToEmployee(
          payload.employeeId,
          'mission:assigned',
          {
            id: payload.assignmentId,
            deadline: payload.deadline ?? null,
            xpStatus: this.xpGrantedOnCompletion(),
            assignedAt: payload.assignedAt,
            missionId: payload.missionId,
            status:'ASSIGNED',
            mission: {
              name: payload.missionName,
              xpGranted: payload.xpGranted,
              durationDays: payload.durationDays,
            },
          },
        );
      }

      // MissionCompleted/MissionExpired both carry assignmentId — reusing
      // AssignmentDto (fed by a fresh row, same as the REST endpoints) here
      // instead of hand-building an equivalent object from the event
      // payload keeps this shape from drifting out of sync with what
      // GET /missions/my-assignments and /assignments/latest return.
      if (eventType === 'MissionCompleted' || eventType === 'MissionExpired') {
        const assignment = await this.assignmentRepo.findOne({
          where: { id: payload.assignmentId },
          relations: { mission: true },
        });
        if (assignment) {
          const dto = new AssignmentDto(assignment, this.xpGrantedOnCompletion());
          this.notificationGateway.emitToEmployee(
            payload.employeeId,
            eventType === 'MissionCompleted' ? 'mission:completed' : 'mission:expired',
            dto,
          );
        }
      }

      this.notificationGateway.emitToEmployee(payload.employeeId, 'activity:new' , {
        id: eventId , eventType , message: messageText , occurredOn: message.fields.occurredOn
      })

    }
    await this.redis.xack(EVENT_STREAM, CONSUMER_GROUP, message.id);
  }

  // Whether completing a mission actually grants XP — derived from the live
  // rule graph (MissionCompleted -> GrantXP wiring), not a mission-catalog
  // field, since it's admin-configurable and can change independently of
  // any one mission. Shared by mission:assigned, mission:completed and
  // mission:expired so the flag means the same thing everywhere it appears.
  private xpGrantedOnCompletion(): boolean {
    return this.rulesCache
      .get('MissionCompleted')
      .some((rule) => rule.action === 'GrantXP');
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
