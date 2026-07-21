import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MissionsController } from './missions.controller';
import { AssignMissionHandler } from './handlers/assign-mission.handler';
import { CompleteMissionHandler } from './handlers/complete-mission.handler';
import { OutboxModule } from '../outbox/outbox.module';

const CommandHandlers = [AssignMissionHandler, CompleteMissionHandler];

@Module({
  imports: [CqrsModule, OutboxModule],
  controllers: [MissionsController],
  providers: [...CommandHandlers],
})
export class MissionsModule {}
