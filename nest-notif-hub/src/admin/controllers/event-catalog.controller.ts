import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateEventCatalogDto } from '../dto/create-event-catalog.dto';
import { UpdateEventCatalogDto } from '../dto/update-event-catalog.dto';
import { CreateEventCatalogCommand } from '../../rule-engine/commands/create-event-catalog.command';
import { UpdateEventCatalogCommand } from '../../rule-engine/commands/update-event-catalog.command';
import { DeleteEventCatalogCommand } from '../../rule-engine/commands/delete-event-catalog.command';
import { GetEventCatalogQuery } from '../../rule-engine/queries/get-event-catalog.query';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

@Controller('admin/event-catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class EventCatalogController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  findAll() {
    return this.queryBus.execute(new GetEventCatalogQuery());
  }

  @Post()
  create(@Body() dto: CreateEventCatalogDto) {
    return this.commandBus.execute(
      new CreateEventCatalogCommand(dto.eventType, dto.payloadFields),
    );
  }

  @Patch(':eventType')
  update(@Param('eventType') eventType: string, @Body() dto: UpdateEventCatalogDto) {
    return this.commandBus.execute(
      new UpdateEventCatalogCommand(eventType, dto.payloadFields),
    );
  }

  @Delete(':eventType')
  remove(@Param('eventType') eventType: string) {
    return this.commandBus.execute(new DeleteEventCatalogCommand(eventType));
  }
}
