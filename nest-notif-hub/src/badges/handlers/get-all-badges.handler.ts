import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetAllBadgesQuery } from '../queries/get-all-badges.query';
import { BadgeEntity } from '../entities/badge.entity';

@QueryHandler(GetAllBadgesQuery)
export class GetAllBadgesHandler implements IQueryHandler<GetAllBadgesQuery> {
  constructor(
    @InjectRepository(BadgeEntity)
    private readonly badgeRepo: Repository<BadgeEntity>,
  ) {}

  execute(): Promise<BadgeEntity[]> {
    return this.badgeRepo.find();
  }
}
