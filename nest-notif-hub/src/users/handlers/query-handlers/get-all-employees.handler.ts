import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetAllEmployeesQuery } from '../../queries/get-all-employees.query';
import { InjectRepository } from '@nestjs/typeorm';
import { EmployeeUserEntity } from '../../entities/employee-user.entity';
import { Repository } from 'typeorm';

@QueryHandler(GetAllEmployeesQuery)
export class GetAllEmployeesHandler implements IQueryHandler<GetAllEmployeesQuery> {

  constructor(
    @InjectRepository(EmployeeUserEntity)
    private readonly employeeUserRepository : Repository<EmployeeUserEntity>
  ) {}

  async execute(query: GetAllEmployeesQuery): Promise<EmployeeUserEntity[]> {
    // Only apply an order clause when the caller actually asked for one —
    // `query` itself is always a real object here (QueryBus always passes
    // one), so checking `query.order` is what actually distinguishes
    // "no filter given" from "filter given".
    return query.order
      ? this.employeeUserRepository.find({ order: { level: query.order } })
      : this.employeeUserRepository.find();
  }

}