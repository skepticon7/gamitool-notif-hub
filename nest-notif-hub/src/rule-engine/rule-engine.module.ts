import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventCatalogEntity } from './entities/event-catalog.entity';
import { EventLinkEntity } from './entities/event-link.entity';
import { ProcessedEventsEntity } from './entities/processed-events.entity';
import { ScheduledReminderEntity } from './entities/scheduled-reminder.entity';
import { RuleEngineConsumer } from './services/rule-engine.consumer';
import { ReminderSweepService } from './services/reminder-sweep.service';
import { RulesCache } from './services/rules-cache';
import { ActionRegistry, ACTION_PROVIDERS } from './actions/action-registry';
import { EmitEventAction } from './actions/emit-event.action';
import { GrantXPAction } from './actions/grant-xp.action';
import { CheckLevelThresholdAction } from './actions/check-level-threshold.action';
import { ScheduleReminderAction } from './actions/schedule-reminder.action';
import { CancelReminderAction } from './actions/cancel-reminder.action';
import { OutboxModule } from '../outbox/outbox.module';
import { EmployeesModule } from '../employees/employees.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotifyAction } from '../notifications/actions/notify.action';

@Module({
  imports : [
    TypeOrmModule.forFeature([EventCatalogEntity , EventLinkEntity , ProcessedEventsEntity , ScheduledReminderEntity]),
    OutboxModule,
    EmployeesModule,
    NotificationsModule,
  ],
  providers : [
    RuleEngineConsumer,
    ReminderSweepService,
    RulesCache,
    ActionRegistry,
    EmitEventAction,
    GrantXPAction,
    CheckLevelThresholdAction,
    ScheduleReminderAction,
    CancelReminderAction,
    {
      provide: ACTION_PROVIDERS,
      useFactory: (
        emitEvent: EmitEventAction,
        grantXp: GrantXPAction,
        checkLevel: CheckLevelThresholdAction,
        notify: NotifyAction,
        reminder : ScheduleReminderAction,
        cancelReminder: CancelReminderAction,
      ) => [emitEvent, grantXp, checkLevel, notify , reminder, cancelReminder],
      inject: [EmitEventAction, GrantXPAction, CheckLevelThresholdAction, NotifyAction , ScheduleReminderAction, CancelReminderAction],
    },
  ],
  exports : [TypeOrmModule, ActionRegistry, RulesCache]
})
export class RuleEngineModule {}
