import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetEventCatalogQuery } from '../../rule-engine/queries/get-event-catalog.query';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

// Read-only, deliberately — the event catalog is developer-owned (see
// EVENT_CATALOG_SEED / EventCatalogSeedService), same model as
// ActionsController: the admin picks from a fixed, code-defined set when
// wiring the graph, never defines new events/fields themselves. This is
// what stops the admin (an HR user, not a developer) from wiring a
// template to a field that doesn't actually exist on some event.
@Controller('admin/event-catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class EventCatalogController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  findAll() {
    return this.queryBus.execute(new GetEventCatalogQuery());
  }
}
