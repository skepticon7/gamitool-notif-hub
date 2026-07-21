import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeEntity } from './entities/employee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeEntity])],
  exports: [TypeOrmModule],
})
export class EmployeesModule {}
