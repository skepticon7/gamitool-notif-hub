import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { AppJwtPayload } from '../auth/types/auth.interfaces';
import { GetMyEmployeeProfileQuery } from './queries/get-my-employee-profile.query';

// Employee-only, unlike AccountsController (entirely @Roles('admin')) — an
// admin JWT calling this gets a clean 403, not a repurposed "account not
// provisioned" error. Confirmed empirically: EmployeeUserEntity's STI
// discriminator means its repository never even finds an admin's row (not
// "found with xp/level null" — genuinely not found), so there's no clean
// way to answer "your profile" for a non-employee here at all.
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('employee')
export class EmployeesController {
  constructor(private readonly queryBus: QueryBus) {}

  // employeeId comes from the caller's own JWT, never a URL param — same
  // reasoning as MissionsController.myAssignments(): stops one employee
  // reading another's XP/level by guessing an id. STI means the JWT's
  // userId IS the EmployeeUserEntity's own id directly, no lookup needed.
  @Get('me')
  me(@Req() req: { user: AppJwtPayload }) {
    return this.queryBus.execute(new GetMyEmployeeProfileQuery(req.user.userId));
  }
}
