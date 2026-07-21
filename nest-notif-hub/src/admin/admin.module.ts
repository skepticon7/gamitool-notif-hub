import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventCatalogEntity } from '../rule-engine/entities/event-catalog.entity';
import { EventLinkEntity } from '../rule-engine/entities/event-link.entity';
import { RuleEngineModule } from '../rule-engine/rule-engine.module';
import { EventCatalogController } from './controllers/event-catalog.controller';
import { EventLinksController } from './controllers/event-links.controller';
import { ActionsController } from './controllers/actions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventCatalogEntity, EventLinkEntity]),
    RuleEngineModule,
  ],
  controllers: [EventCatalogController, EventLinksController, ActionsController],
})
export class AdminModule {}
