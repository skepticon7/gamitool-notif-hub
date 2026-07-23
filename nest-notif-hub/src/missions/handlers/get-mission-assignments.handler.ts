import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../shared/redis/redis.constants';
import { CacheableQuery } from '../../shared/cache/cacheable-query.decorator';
import { GetMissionAssignmentsQuery } from '../queries/get-mission-assignments.query';
import { MissionAssignmentEntity } from '../entities/mission-assignment.entity';
import { buildAssignmentWhere } from '../queries/build-assignment-where';

@QueryHandler(GetMissionAssignmentsQuery)
export class GetMissionAssignmentsHandler
  implements IQueryHandler<GetMissionAssignmentsQuery>
{
  constructor(
    @InjectRepository(MissionAssignmentEntity)
    private readonly repo: Repository<MissionAssignmentEntity>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @CacheableQuery(30)
  execute(query: GetMissionAssignmentsQuery) {
    return this.repo.find({ where: buildAssignmentWhere(query) });
  }
}
