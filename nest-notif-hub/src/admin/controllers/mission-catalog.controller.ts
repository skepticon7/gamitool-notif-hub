import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateMissionDto } from '../dto/create-mission.dto';
import { UpdateMissionDto } from '../dto/update-mission.dto';
import { CreateMissionCommand } from '../../missions/commands/create-mission.command';
import { UpdateMissionCommand } from '../../missions/commands/update-mission.command';
import { DeleteMissionCommand } from '../../missions/commands/delete-mission.command';
import { GetAllMissionsQuery } from '../../missions/queries/get-all-missions.query';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

// Admin CRUD for the mission catalog — distinct from MissionsController
// (src/missions/missions.controller.ts), which handles employee-facing
// assign/complete actions, not catalog management. Dispatches through
// CommandBus/QueryBus rather than a plain service, matching the CQRS
// pattern already used for assign/complete.
@Controller('admin/missions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MissionCatalogController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  findAll() {
    return this.queryBus.execute(new GetAllMissionsQuery());
  }

  @Post()
  create(@Body() dto: CreateMissionDto) {
    return this.commandBus.execute(new CreateMissionCommand(dto.name, dto.xpGranted, dto.durationDays));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMissionDto) {
    return this.commandBus.execute(
      new UpdateMissionCommand(id, dto.name, dto.xpGranted, dto.durationDays),
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.commandBus.execute(new DeleteMissionCommand(id));
  }
}
