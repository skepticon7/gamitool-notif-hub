import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadgeEntity } from './entities/badge.entity';
import { CreateBadgeHandler } from './handlers/create-badge.handler';
import { UpdateBadgeHandler } from './handlers/update-badge.handler';
import { DeleteBadgeHandler } from './handlers/delete-badge.handler';
import { GetAllBadgesHandler } from './handlers/get-all-badges.handler';
import { GetMyBadgesHandler } from './handlers/get-my-badges.handler';
import { BadgesController } from './badges.controller';
import { UsersModule } from '../users/users.module';

const CommandHandlers = [CreateBadgeHandler, UpdateBadgeHandler, DeleteBadgeHandler];
const QueryHandlers = [GetAllBadgesHandler, GetMyBadgesHandler];

@Module({
  controllers : [BadgesController],
  imports: [
    UsersModule,
    CqrsModule,
    TypeOrmModule.forFeature([BadgeEntity]),
  ],
  providers: [...CommandHandlers, ...QueryHandlers],
  exports: [TypeOrmModule],
})
export class BadgesModule {}
