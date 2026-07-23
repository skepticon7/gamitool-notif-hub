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
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    RuleEngineModule,
    CqrsModule,
    UsersModule,
  ],
  controllers: [
    EventCatalogController,
    EventLinksController,
    ActionsController,
    MissionCatalogController,
    MissionAssignmentsController,
    AccountsController,
    BadgeCatalogController,
  ],
})
export class AdminModule {}
