import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { MissionActionDto } from './dto/mission-action.dto';
import { MissionAssignmentFiltersDto } from './dto/mission-assignment-filters.dto';
import { BulkAssignMissionDto } from './dto/bulk-assign-mission.dto';
import { AssignMissionCommand } from './commands/assign-mission.command';
import { BulkAssignMissionCommand } from './commands/bulk-assign-mission.command';
import { CompleteMissionCommand } from './commands/complete-mission.command';
import { GetMyMissionAssignmentsQuery } from './queries/get-my-mission-assignments.query';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { AppJwtPayload } from '../auth/types/auth.interfaces';
import { GetLatestMissionAssignmentsQuery } from './queries/get-latest-mission-assignments.query';

@Controller('missions')
@UseGuards(JwtAuthGuard)
export class MissionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // Admin acting on behalf of an arbitrary employee — dto.employeeId is
  // trusted here only because RolesGuard restricts this route to admins.
  @Post('assign')
  @UseGuards(RolesGuard)
  @Roles('admin')
  assign(@Body() dto: MissionActionDto) {
    return this.commandBus.execute(
      new AssignMissionCommand(dto.missionId, dto.employeeId),
    );
  }

  // Admin-only, same trust reasoning as /assign — assigns to every current
  // employee in one call. Already-assigned employees are silently skipped,
  // not treated as a failure — see BulkAssignMissionHandler.
  @Post('assign-all')
  @UseGuards(RolesGuard)
  @Roles('admin')
  assignAll(@Body() dto: BulkAssignMissionDto) {
    return this.commandBus.execute(new BulkAssignMissionCommand(dto.missionId));
  }

  // Owner-or-admin. With users/employees on one STI table, the caller's own
  // employeeId IS req.user.userId — no lookup needed to find "their" row.
  @Post('assignments/:assignmentId/complete')
  complete(
    @Param('assignmentId') assignmentId: string,
    @Req() req: { user: AppJwtPayload },
  ) {
    const isAdmin = req.user.groups.includes('admin');
    return this.commandBus.execute(
      new CompleteMissionCommand(assignmentId, req.user.userId, isAdmin),
    );
  }

  // employeeId is derived from the caller's own JWT, never from the URL —
  // this is what stops one employee from reading another's assignments by
  // just changing the path param (horizontal privilege escalation).
  @Get('my-assignments')
  myAssignments(
    @Req() req: { user: AppJwtPayload },
    @Query() filters: MissionAssignmentFiltersDto,
  ) {
    return this.queryBus.execute(
      new GetMyMissionAssignmentsQuery(
        req.user.userId,
        filters.status,
      ),
    );
  }

  @Get('assignments/latest')
  latestAssignments(
    @Req() req: { user: AppJwtPayload }
  ) {
    return this.queryBus.execute(
      new GetLatestMissionAssignmentsQuery(
        req.user.userId
      )
    );
  }

}
