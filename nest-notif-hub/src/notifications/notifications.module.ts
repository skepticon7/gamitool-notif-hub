import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CqrsModule } from '@nestjs/cqrs';
import { NotifyAction } from './actions/notify.action';
import { N8nProcessor } from './workers/n8n.processor';
import { UsersModule } from '../users/users.module';
import { InAppProcessor } from './workers/in-app.processor';
import { OutboxModule } from '../outbox/outbox.module';
import { NotificationsController } from './notifications.controller';
import { GetNotificationHistoryHandler } from './handlers/get-notification-history.handler';

const QueryHandlers = [GetNotificationHistoryHandler];

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'n8n' },
      { name: 'in-app' },
    ),
    UsersModule,
    OutboxModule,
    CqrsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotifyAction, N8nProcessor, InAppProcessor, ...QueryHandlers],
  exports: [NotifyAction],
})
export class NotificationsModule {}
