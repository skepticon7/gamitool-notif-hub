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
import { RulesCache } from '../../rule-engine/services/rules-cache';
import { AssignmentDto } from '../dto/assignments.dto';

@QueryHandler(GetMyMissionAssignmentsQuery)
export class GetMyMissionAssignmentsHandler
  implements IQueryHandler<GetMyMissionAssignmentsQuery>
{
  constructor(
    @InjectRepository(MissionAssignmentEntity)
    private readonly repo: Repository<MissionAssignmentEntity>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly rulesCache : RulesCache
  ) {}

  async execute(query: GetMyMissionAssignmentsQuery) {
    const xpStatus = this.rulesCache
      .get('MissionCompleted')
      .some((rule) => rule.action === 'GrantXP');
    const assignments = await this.repo.find({
      where: { ...buildAssignmentWhere(query), employeeId: query.employeeId },
      relations : {mission : true}
    });

    return assignments.map(a => new AssignmentDto(a , xpStatus))

  }
}
