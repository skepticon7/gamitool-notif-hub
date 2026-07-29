import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetNotificationHistoryQuery } from './queries/get-notification-history.query';
import { GetNotificationStatsQuery } from './queries/get-notification-stats.query';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class NotificationsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  findHistory(@Query('limit') limit?: string) {
    return this.queryBus.execute(new GetNotificationHistoryQuery(limit ? Number(limit) : undefined));
  }

  @Get('stats')
  findStats() {
    return this.queryBus.execute(new GetNotificationStatsQuery());
  }
}
