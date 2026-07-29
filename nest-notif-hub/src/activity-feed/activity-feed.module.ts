import { Module } from '@nestjs/common';
import { NotificationGateway } from '../websocket/notification.gateway';
import { WebsocketModule } from '../websocket/websocket.module';
import { CqrsModule } from '@nestjs/cqrs';
import { OutboxModule } from '../outbox/outbox.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityFeedEntry, ActivityFeedEntrySchema } from './schemas/activity-feed-entry.schema';
import { ActivityFeedController } from './activity-feed.controller';
import { ActivityFeedConsumer } from './services/activity-feed.consumer';
import { GetMyActivityFeedHandler } from './handlers/get-my-activity-feed.handler';

const handlers = [GetMyActivityFeedHandler]

@Module({
  imports: [
    WebsocketModule ,
    CqrsModule,
    OutboxModule ,
    MongooseModule.forFeature([{name : ActivityFeedEntry.name , schema : ActivityFeedEntrySchema}]),
  ],
  controllers: [ActivityFeedController],
  providers: [ActivityFeedConsumer , ...handlers]
})
export class ActivityFeedModule {}