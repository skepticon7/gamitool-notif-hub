import { Module } from '@nestjs/common';
import { EmployeeProjectionConsumer } from './services/employee-projection.consumer';
import { MongooseModule } from '@nestjs/mongoose';
import {
  EmployeeProjection,
  EmployeeProjectionSchema,
} from './schemas/employee-projection.schema';
import { OutboxModule } from '../outbox/outbox.module';

// Purely the Mongo read-model projection now — the SQL Employee entity moved
// to users/entities/employee-user.entity.ts (Single Table Inheritance with
// UserEntity/AdminUserEntity, see UsersModule).
@Module({
  imports: [
    MongooseModule.forFeature([{name : EmployeeProjection.name , schema : EmployeeProjectionSchema}]),
    OutboxModule,
  ],
  providers : [EmployeeProjectionConsumer],
})
export class EmployeesModule {}
