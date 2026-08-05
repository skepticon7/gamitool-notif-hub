import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../shared/redis/redis.constants';
import { CacheableQuery } from '../../shared/cache/cacheable-query.decorator';
import { GetMyMissionAssignmentsQuery } from '../queries/get-my-mission-assignments.query';
import { MissionAssignmentEntity } from '../entities/mission-assignment.entity';
import { buildAssignmentWhere } from '../queries/build-assignment-where';

@QueryHandler(GetMyMissionAssignmentsQuery)
export class GetMyMissionAssignmentsHandler
  implements IQueryHandler<GetMyMissionAssignmentsQuery>
{
  constructor(
    @InjectRepository(MissionAssignmentEntity)
    private readonly repo: Repository<MissionAssignmentEntity>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  execute(query: GetMyMissionAssignmentsQuery) {
    return this.repo.find({
      where: { ...buildAssignmentWhere(query), employeeId: query.employeeId },
      relations : {mission : true}
    });
  }
}
