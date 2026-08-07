import { Module } from '@nestjs/common';
import { NotificationGateway } from '../websocket/notification.gateway';
import { WebsocketModule } from '../websocket/websocket.module';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '../outbox/outbox.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityFeedEntry, ActivityFeedEntrySchema } from './schemas/activity-feed-entry.schema';
import { ActivityFeedController } from './activity-feed.controller';
import { ActivityFeedConsumer } from './services/activity-feed.consumer';
import { GetMyActivityFeedHandler } from './handlers/get-my-activity-feed.handler';
import { RulesCacheModule } from '../rule-engine/rules-cache.module';
import { MissionAssignmentEntity } from '../missions/entities/mission-assignment.entity';

const handlers = [GetMyActivityFeedHandler]

@Module({
  imports: [
    WebsocketModule ,
    CqrsModule,
    OutboxModule ,
    RulesCacheModule ,
    // Registered here too (not via importing MissionsModule) — same
    // multi-module registration pattern UsersModule already documents for
    // this exact entity: needed so ActivityFeedConsumer can fetch the full
    // row for MissionCompleted/MissionExpired and reuse AssignmentDto
    // as-is, instead of hand-duplicating its fields from event payloads.
    TypeOrmModule.forFeature([MissionAssignmentEntity]),
    MongooseModule.forFeature([{name : ActivityFeedEntry.name , schema : ActivityFeedEntrySchema}]),
  ],
  controllers: [ActivityFeedController],
  providers: [ActivityFeedConsumer , ...handlers]
})
export class ActivityFeedModule {}