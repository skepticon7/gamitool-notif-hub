import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotifyAction } from './actions/notify.action';
import { EmailProcessor } from './workers/email.processor';
import { EmployeesModule } from '../employees/employees.module';
import { SmsProcessor } from './workers/sms.processor';
import { InAppProcessor } from './workers/in-app.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'sms' },
      { name: 'in-app' },
    ),
    EmployeesModule,
  ],
  providers: [NotifyAction, EmailProcessor , SmsProcessor , InAppProcessor],
  exports: [NotifyAction],
})
export class NotificationsModule {}
