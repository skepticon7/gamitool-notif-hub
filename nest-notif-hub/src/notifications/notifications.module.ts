import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotifyAction } from './actions/notify.action';
import { N8nProcessor } from './workers/n8n.processor';
import { UsersModule } from '../users/users.module';
import { InAppProcessor } from './workers/in-app.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'n8n' },
      { name: 'in-app' },
    ),
    UsersModule,
  ],
  providers: [NotifyAction, N8nProcessor, InAppProcessor],
  exports: [NotifyAction],
})
export class NotificationsModule {}
