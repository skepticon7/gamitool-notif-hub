import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateAccountDto } from '../dto/create-account.dto';
import { CreateAccountCommand } from '../../users/commands/create-account.command';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { EmployeesListFiltersDto } from '../../users/dto/employees-list-filters.dto';
import { GetAllEmployeesQuery } from '../../users/queries/get-all-employees.query';

// The only way any account (admin or employee) gets created, other than the
// one-time bootstrap seed for the very first admin. See CreateAccountHandler.
@Controller('admin/accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus : QueryBus
  ) {}

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.commandBus.execute(
      new CreateAccountCommand(dto.email, dto.name, dto.role),
    );
  }


  @Get('employees')
  findEmployees(@Query() filters : EmployeesListFiltersDto) {
    return this.queryBus.execute(
      new GetAllEmployeesQuery(
        filters.level,
        filters.order
      )
    );
  }
}
