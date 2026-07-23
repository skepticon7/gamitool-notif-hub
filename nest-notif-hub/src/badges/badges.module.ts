import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadgeEntity } from './entities/badge.entity';
import { CreateBadgeHandler } from './handlers/create-badge.handler';
import { UpdateBadgeHandler } from './handlers/update-badge.handler';
import { DeleteBadgeHandler } from './handlers/delete-badge.handler';
import { GetAllBadgesHandler } from './handlers/get-all-badges.handler';

const CommandHandlers = [CreateBadgeHandler, UpdateBadgeHandler, DeleteBadgeHandler];
const QueryHandlers = [GetAllBadgesHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([BadgeEntity]),
  ],
  providers: [...CommandHandlers, ...QueryHandlers],
  exports: [TypeOrmModule],
})
export class BadgesModule {}
