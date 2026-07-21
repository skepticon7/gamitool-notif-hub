import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { MySqlUserRepository } from './repositories/mysql-user-repository';
import { MongoUserRepository } from './repositories/mongo-user.repository';
import { CreateUserCommand } from './commands/create-user.command';
import { GetUserQuery } from './queries/get-user.query';
import { OutboxEntity } from '../outbox/entities/outbox.entity';
import { CreateUserHandler } from './handlers/command-handlers/create-user.handler';
import { OutboxModule } from '../outbox/outbox.module';

const CommandHandlers = [CreateUserHandler];
const QueryHandlers = [GetUserQuery];

@Module({
  imports : [
    TypeOrmModule.forFeature([UserEntity]),
    MongooseModule.forFeature([
      {
        name: User.name,
        schema : UserSchema
      }
    ]),
    OutboxModule
  ],
  providers : [
    MySqlUserRepository,
    MongoUserRepository,
    ...CommandHandlers,
    ...QueryHandlers
  ],
  exports : [
    MySqlUserRepository ,
    MongoUserRepository
  ]
})

export class UsersModule{}