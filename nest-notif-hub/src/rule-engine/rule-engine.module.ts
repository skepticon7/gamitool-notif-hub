import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventCatalogEntity } from './entities/event-catalog.entity';
import { EventLinkEntity } from './entities/event-link.entity';
import { ProcessedEventsEntity } from './entities/processed-events.entity';
import { ScheduledReminderEntity } from './entities/scheduled-reminder.entity';
import { RuleEngineConsumer } from './services/rule-engine.consumer';
import { ReminderSweepService } from './services/reminder-sweep.service';
import { RulesCache } from './services/rules-cache';
import { EventLinkGraphValidator } from './services/event-link-graph-validator.service';
import { ActionRegistry, ACTION_PROVIDERS } from './actions/action-registry';
import { EmitEventAction } from './actions/emit-event.action';
import { GrantXPAction } from './actions/grant-xp.action';
import { CheckLevelThresholdAction } from './actions/check-level-threshold.action';
import { ScheduleReminderAction } from './actions/schedule-reminder.action';
import { CancelReminderAction } from './actions/cancel-reminder.action';
import { GrantBadgeAction } from './actions/grant-badge.action';
import { MissionAssignmentEntity } from '../missions/entities/mission-assignment.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { UsersModule } from '../users/users.module';
import { BadgesModule } from '../badges/badges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotifyAction } from '../notifications/actions/notify.action';
import { CreateEventLinkHandler } from './handlers/create-event-link.handler';
import { UpdateEventLinkHandler } from './handlers/update-event-link.handler';
import { DeleteEventLinkHandler } from './handlers/delete-event-link.handler';
import { GetEventLinksHandler } from './handlers/get-event-links.handler';
import { CreateEventCatalogHandler } from './handlers/create-event-catalog.handler';
import { UpdateEventCatalogHandler } from './handlers/update-event-catalog.handler';
import { DeleteEventCatalogHandler } from './handlers/delete-event-catalog.handler';
import { GetEventCatalogHandler } from './handlers/get-event-catalog.handler';

const CommandHandlers = [
  CreateEventLinkHandler,
  UpdateEventLinkHandler,
  DeleteEventLinkHandler,
  CreateEventCatalogHandler,
  UpdateEventCatalogHandler,
  DeleteEventCatalogHandler,
];
const QueryHandlers = [GetEventLinksHandler, GetEventCatalogHandler];

@Module({
  imports : [
    TypeOrmModule.forFeature([EventCatalogEntity , EventLinkEntity , ProcessedEventsEntity , ScheduledReminderEntity , MissionAssignmentEntity]),
    CqrsModule,
    OutboxModule,
    UsersModule,
    BadgesModule,
    NotificationsModule,
  ],
  providers : [
    RuleEngineConsumer,
    ReminderSweepService,
    RulesCache,
    ActionRegistry,
    EventLinkGraphValidator,
    EmitEventAction,
    GrantXPAction,
    CheckLevelThresholdAction,
    ScheduleReminderAction,
    CancelReminderAction,
    GrantBadgeAction,
    ...CommandHandlers,
    ...QueryHandlers,
    {
      provide: ACTION_PROVIDERS,
      useFactory: (
        emitEvent: EmitEventAction,
        grantXp: GrantXPAction,
        checkLevel: CheckLevelThresholdAction,
        notify: NotifyAction,
        reminder : ScheduleReminderAction,
        cancelReminder: CancelReminderAction,
        grantBadge: GrantBadgeAction,
      ) => [emitEvent, grantXp, checkLevel, notify , reminder, cancelReminder, grantBadge],
      inject: [EmitEventAction, GrantXPAction, CheckLevelThresholdAction, NotifyAction , ScheduleReminderAction, CancelReminderAction, GrantBadgeAction],
    },
  ],
  exports : [TypeOrmModule, ActionRegistry, RulesCache]
})
export class RuleEngineModule {}
