import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { UserEntity } from './entities/user.entity';
import { EmployeeUserEntity } from './entities/employee-user.entity';
import { AdminUserEntity } from './entities/admin-user.entity';
import { EmployeeBadgeEntity } from './entities/employee-badge.entity';
import { MissionAssignmentEntity } from '../missions/entities/mission-assignment.entity';
import { BadgeEntity } from '../badges/entities/badge.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { MySqlUserRepository } from './repositories/mysql-user-repository';
import { MongoUserRepository } from './repositories/mongo-user.repository';
import { OutboxEntity } from '../outbox/entities/outbox.entity';
import { CreateUserHandler } from './handlers/command-handlers/create-user.handler';
import { CreateAccountHandler } from './handlers/command-handlers/create-account.handler';
import { GetUserHandler } from './handlers/query-handlers/get-user.handler';
import { GetMyEmployeeProfileHandler } from './handlers/query-handlers/get-my-employee-profile.handler';
import { EmployeesController } from './employees.controller';
import { OutboxModule } from '../outbox/outbox.module';
import { AuthentikModule } from '../infrastructure/authentik/authentik.module';

const CommandHandlers = [CreateUserHandler, CreateAccountHandler];
const QueryHandlers = [GetUserHandler, GetMyEmployeeProfileHandler];

@Module({
  controllers: [EmployeesController],
  imports : [
    // Registering the STI hierarchy's own repository token (UserEntity) is
    // enough for TypeORM to resolve queries/saves against the child classes
    // too — EmployeeUserEntity/AdminUserEntity share the same table/metadata
    // tree. Listed explicitly so autoLoadEntities picks up their columns.
    //
    // MissionAssignmentEntity/BadgeEntity are "owned" by MissionsModule/
    // BadgesModule, but registered here too rather than importing those
    // modules — BadgesModule already imports UsersModule, so UsersModule
    // importing BadgesModule back would be a real circular dependency
    // (same class of issue already solved once for UsersModule/OutboxModule
    // — see that reasoning elsewhere in this codebase). TypeORM allows the
    // same entity to be registered in multiple modules' forFeature() calls
    // independently — each gets its own repository token over the same
    // table, no cross-module import needed. MissionsModule already does
    // exactly this for EmployeeUserEntity.
    TypeOrmModule.forFeature([
      UserEntity,
      EmployeeUserEntity,
      AdminUserEntity,
      EmployeeBadgeEntity,
      MissionAssignmentEntity,
      BadgeEntity,
    ]),
    MongooseModule.forFeature([
      {
        name: User.name,
        schema : UserSchema
      }
    ]),
    OutboxModule,
    AuthentikModule,
    CqrsModule,
  ],
  providers : [
    MySqlUserRepository,
    MongoUserRepository,
    ...CommandHandlers,
    ...QueryHandlers
  ],
  exports : [
    MySqlUserRepository ,
    MongoUserRepository ,
    TypeOrmModule,
  ]
})

export class UsersModule{}
