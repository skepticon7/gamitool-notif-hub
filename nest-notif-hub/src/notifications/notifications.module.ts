import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotifyAction } from './actions/notify.action';
import { N8nProcessor } from './workers/n8n.processor';
import { UsersModule } from '../users/users.module';
import { OutboxModule } from '../outbox/outbox.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotificationsController } from './notifications.controller';
import { InAppNotificationsController } from './in-app-notifications.controller';
import { InAppNotificationEntity } from './entities/in-app-notification.entity';
import { GetNotificationHistoryHandler } from './handlers/get-notification-history.handler';
import { GetNotificationStatsHandler } from './handlers/get-notification-stats.handler';
import { GetMyInAppNotificationsHandler } from './handlers/get-my-in-app-notifications.handler';
import { GetUnreadNotificationCountQueryHandler } from './handlers/get-unread-notification-count.handler';
import { MarkNotificationReadHandler } from './handlers/mark-notification-read.handler';
import { MarkAllNotificationsReadHandler } from './handlers/mark-all-notifications-read.handler';

const QueryHandlers = [
  GetNotificationHistoryHandler,
  GetNotificationStatsHandler,
  GetMyInAppNotificationsHandler,
  GetUnreadNotificationCountQueryHandler,
];
const CommandHandlers = [MarkNotificationReadHandler, MarkAllNotificationsReadHandler];

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'n8n' },
    ),
    TypeOrmModule.forFeature([InAppNotificationEntity]),
    UsersModule,
    OutboxModule,
    WebsocketModule,
    CqrsModule,
  ],
  controllers: [NotificationsController, InAppNotificationsController],
  providers: [NotifyAction, N8nProcessor, ...QueryHandlers, ...CommandHandlers],
  exports: [NotifyAction],
})
export class NotificationsModule {}
