import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { QueryBus } from '@nestjs/cqrs';
import { AppJwtPayload } from '../auth/types/auth.interfaces';
import { GetMyBadgesQuery } from './queries/get-my-badges.query';

@Controller('badges')
@UseGuards(JwtAuthGuard , RolesGuard)
export class BadgesController {

  constructor(
    private readonly queryBus: QueryBus
  ) {}

  @Get('my-badges')
  findEmployeeBadges(
    @Req() req : { user: AppJwtPayload }
  ) {
    return this.queryBus.execute(new GetMyBadgesQuery(req.user.userId));
  }

}