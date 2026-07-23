import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateBadgeDto } from '../dto/create-badge.dto';
import { UpdateBadgeDto } from '../dto/update-badge.dto';
import { CreateBadgeCommand } from '../../badges/commands/create-badge.command';
import { UpdateBadgeCommand } from '../../badges/commands/update-badge.command';
import { DeleteBadgeCommand } from '../../badges/commands/delete-badge.command';
import { GetAllBadgesQuery } from '../../badges/queries/get-all-badges.query';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

// Badge catalog — same role as MissionCatalogController for missions.
// GrantBadgeAction references a badge by id (params.badgeId in an
// event_link) rather than having name/threshold retyped into every wiring.
@Controller('admin/badges')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class BadgeCatalogController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  findAll() {
    return this.queryBus.execute(new GetAllBadgesQuery());
  }

  @Post()
  create(@Body() dto: CreateBadgeDto) {
    return this.commandBus.execute(
      new CreateBadgeCommand(dto.name, dto.threshold, dto.description),
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBadgeDto) {
    return this.commandBus.execute(
      new UpdateBadgeCommand(id, dto.name, dto.threshold, dto.description),
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.commandBus.execute(new DeleteBadgeCommand(id));
  }
}
