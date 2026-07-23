import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateEventLinkDto } from '../dto/create-event-link.dto';
import { UpdateEventLinkDto } from '../dto/update-event-link.dto';
import { CreateEventLinkCommand } from '../../rule-engine/commands/create-event-link.command';
import { UpdateEventLinkCommand } from '../../rule-engine/commands/update-event-link.command';
import { DeleteEventLinkCommand } from '../../rule-engine/commands/delete-event-link.command';
import { GetEventLinksQuery } from '../../rule-engine/queries/get-event-links.query';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

// RuleEngineConsumer reads rules from RulesCache, an in-memory map — not
// from this table directly. Every mutating handler calls rulesCache.reload()
// afterward, so the change is live before this response even returns.
@Controller('admin/event-links')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class EventLinksController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  findAll(@Query('sourceEvent') sourceEvent?: string) {
    return this.queryBus.execute(new GetEventLinksQuery(sourceEvent));
  }

  @Post()
  create(@Body() dto: CreateEventLinkDto) {
    return this.commandBus.execute(
      new CreateEventLinkCommand(dto.sourceEvent, dto.action, dto.params, dto.targetEvent),
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventLinkDto) {
    return this.commandBus.execute(
      new UpdateEventLinkCommand(id, dto.sourceEvent, dto.action, dto.params, dto.targetEvent),
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.commandBus.execute(new DeleteEventLinkCommand(id));
  }
}
