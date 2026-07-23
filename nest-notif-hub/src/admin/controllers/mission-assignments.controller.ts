import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { MissionAssignmentFiltersDto } from '../../missions/dto/mission-assignment-filters.dto';
import { GetMissionAssignmentsQuery } from '../../missions/queries/get-mission-assignments.query';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

// Admin view over every assignment, unscoped — see MissionsController's
// /missions/my-assignments for the user-scoped equivalent.
@Controller('admin/mission-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MissionAssignmentsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  findAll(@Query() filters: MissionAssignmentFiltersDto) {
    return this.queryBus.execute(
      new GetMissionAssignmentsQuery(
        filters.status,
        filters.assignedFrom,
        filters.assignedTo,
        filters.completedFrom,
        filters.completedTo,
      ),
    );
  }
}
