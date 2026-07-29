import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RuleEngineModule } from '../rule-engine/rule-engine.module';
import { EventCatalogController } from './controllers/event-catalog.controller';
import { EventLinksController } from './controllers/event-links.controller';
import { ActionsController } from './controllers/actions.controller';
import { MissionCatalogController } from './controllers/mission-catalog.controller';
import { MissionAssignmentsController } from './controllers/mission-assignments.controller';
import { AccountsController } from './controllers/accounts.controller';
import { BadgeCatalogController } from './controllers/badge-catalog.controller';
import { EngineActivityController } from './controllers/engine-activity.controller';
import { SchedulmentsController } from './controllers/schedulments.controller';
import { UsersModule } from '../users/users.module';
import { OutboxModule } from '../outbox/outbox.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { GetEngineActivityHandler } from './handlers/get-engine-activity.handler';
import { EngineActivityConsumer } from './services/engine-activity.consumer';

// Engine Activity is the one exception to "admin has no handlers of its
// own" (see CLAUDE.md) — it has no single owning domain module (spans
// missions, XP, badges, notifications, accounts...), and UsersModule
// already imports OutboxModule, so OutboxModule importing UsersModule back
// would be circular. AdminModule importing both (plus WebsocketModule, for
// the live-push consumer) has no such cycle.
const QueryHandlers = [GetEngineActivityHandler];

@Module({
  imports: [
    RuleEngineModule,
    CqrsModule,
    UsersModule,
    OutboxModule,
    WebsocketModule,
  ],
  controllers: [
    EventCatalogController,
    EventLinksController,
    ActionsController,
    MissionCatalogController,
    MissionAssignmentsController,
    AccountsController,
    BadgeCatalogController,
    EngineActivityController,
    SchedulmentsController,
  ],
  providers: [...QueryHandlers, EngineActivityConsumer],
})
export class AdminModule {}
