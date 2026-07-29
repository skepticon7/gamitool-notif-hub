import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetEngineActivityQuery } from '../queries/get-engine-activity.query';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

@Controller('admin/engine-activity')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class EngineActivityController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  findAll(@Query('limit') limit?: string) {
    return this.queryBus.execute(
      new GetEngineActivityQuery(limit ? Number(limit) : undefined),
    );
  }
}
