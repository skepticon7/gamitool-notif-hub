import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateSchedulmentDto } from '../dto/create-schedulment.dto';
import { UpdateSchedulmentDto } from '../dto/update-schedulment.dto';
import { CreateSchedulmentCommand } from '../../missions/commands/create-schedulment.command';
import { UpdateSchedulmentCommand } from '../../missions/commands/update-schedulment.command';
import { CancelSchedulmentCommand } from '../../missions/commands/cancel-schedulment.command';
import { GetSchedulmentsQuery } from '../../missions/queries/get-schedulments.query';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

// Handlers live in MissionsModule, not here — CommandBus/QueryBus wiring is
// app-global, so AdminModule doesn't need to import MissionsModule for this
// to resolve (same as MissionCatalogController already works today).
@Controller('admin/schedulments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SchedulmentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  findAll() {
    return this.queryBus.execute(new GetSchedulmentsQuery());
  }

  @Post()
  create(@Body() dto: CreateSchedulmentDto) {
    return this.commandBus.execute(
      new CreateSchedulmentCommand(dto.missionId, dto.recurrenceInterval, dto.scope, dto.employeeIds),
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSchedulmentDto) {
    return this.commandBus.execute(
      new UpdateSchedulmentCommand(id, dto.recurrenceInterval, dto.employeeIds),
    );
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.commandBus.execute(new CancelSchedulmentCommand(id));
  }
}
