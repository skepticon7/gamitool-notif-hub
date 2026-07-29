import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AppJwtPayload } from '../auth/types/auth.interfaces';
import { GetMyActivityFeedQuery } from './queries/get-my-activity-feed.query';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';

@Controller('activity-feed')
@UseGuards(JwtAuthGuard)
export class ActivityFeedController {

  constructor(
    private readonly queryBus: QueryBus
  ) {}

  @Get()
  myActivity(@Req() req : {user: AppJwtPayload}) {
    return this.queryBus.execute(new GetMyActivityFeedQuery(req.user.userId));
  }

}