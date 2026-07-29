import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { AppJwtPayload } from '../auth/types/auth.interfaces';
import { GetMyInAppNotificationsQuery } from './queries/get-my-in-app-notifications.query';
import { GetUnreadNotificationCountQuery } from './queries/get-unread-notification-count.query';
import { MarkNotificationReadCommand } from './commands/mark-notification-read.command';
import { MarkAllNotificationsReadCommand } from './commands/mark-all-notifications-read.command';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class InAppNotificationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  myNotifications(@Req() req: { user: AppJwtPayload }) {
    return this.queryBus.execute(new GetMyInAppNotificationsQuery(req.user.userId));
  }

  @Get('unread-count')
  unreadCount(@Req() req: { user: AppJwtPayload }) {
    return this.queryBus.execute(new GetUnreadNotificationCountQuery(req.user.userId));
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: { user: AppJwtPayload }) {
    return this.commandBus.execute(new MarkNotificationReadCommand(id, req.user.userId));
  }

  @Post('read-all')
  markAllRead(@Req() req: { user: AppJwtPayload }) {
    return this.commandBus.execute(new MarkAllNotificationsReadCommand(req.user.userId));
  }
}
