import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionsController } from './missions.controller';
import { AssignMissionHandler } from './handlers/assign-mission.handler';
import { CompleteMissionHandler } from './handlers/complete-mission.handler';
import { CreateMissionHandler } from './handlers/create-mission.handler';
import { UpdateMissionHandler } from './handlers/update-mission.handler';
import { DeleteMissionHandler } from './handlers/delete-mission.handler';
import { GetAllMissionsHandler } from './handlers/get-all-missions.handler';
import { GetMissionAssignmentsHandler } from './handlers/get-mission-assignments.handler';
import { GetMyMissionAssignmentsHandler } from './handlers/get-my-mission-assignments.handler';
import { OutboxModule } from '../outbox/outbox.module';
import { MissionEntity } from './entities/mission.entity';
import { MissionAssignmentEntity } from './entities/mission-assignment.entity';
import { QueryCacheInvalidator } from '../shared/cache/query-cache-invalidator.service';
import { UserEntity } from '../users/entities/user.entity';
import { EmployeeUserEntity } from '../users/entities/employee-user.entity';
import { MissionExpirySweepService } from './services/mission-expiry-sweep.service';
import { MissionRecurrenceSweepService } from './services/mission-recurrence-sweep.service';
import { BulkAssignMissionHandler } from './handlers/bulk-assign-mission.handler';
import { MissionSchedulmentEntity } from './entities/mission-schedulment.entity';
import { CreateSchedulmentHandler } from './handlers/create-schedulment.handler';
import { UpdateSchedulmentHandler } from './handlers/update-schedulment.handler';
import { CancelSchedulmentHandler } from './handlers/cancel-schedulment.handler';
import { GetSchedulmentsHandler } from './handlers/get-schedulments.handler';
import { GetLatestMissionAssignmentsHandler } from './handlers/get-latest-mission-assignments.handler';

const CommandHandlers = [
  AssignMissionHandler,
  BulkAssignMissionHandler,
  CompleteMissionHandler,
  CreateMissionHandler,
  UpdateMissionHandler,
  DeleteMissionHandler,
  CreateSchedulmentHandler,
  UpdateSchedulmentHandler,
  CancelSchedulmentHandler,

];
const QueryHandlers = [
  GetAllMissionsHandler,
  GetMissionAssignmentsHandler,
  GetMyMissionAssignmentsHandler,
  GetSchedulmentsHandler,
  GetLatestMissionAssignmentsHandler
];

@Module({
  imports: [
    CqrsModule,
    OutboxModule,
    TypeOrmModule.forFeature([
      MissionEntity,
      MissionAssignmentEntity,
      EmployeeUserEntity,
      MissionSchedulmentEntity,
    ]),
  ],
  controllers: [MissionsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    QueryCacheInvalidator,
    MissionExpirySweepService,
    MissionRecurrenceSweepService,
  ],
})
export class MissionsModule {}
