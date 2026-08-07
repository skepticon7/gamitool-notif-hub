import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetLatestMissionAssignmentsQuery } from '../queries/get-latest-mission-assignments.query';
import { InjectRepository } from '@nestjs/typeorm';
import { MissionAssignmentEntity } from '../entities/mission-assignment.entity';
import { Repository } from 'typeorm';
import { RulesCache } from '../../rule-engine/services/rules-cache';
import { AssignmentDto } from '../dto/assignments.dto';

@QueryHandler(GetLatestMissionAssignmentsQuery)
export class GetLatestMissionAssignmentsHandler implements IQueryHandler<GetLatestMissionAssignmentsQuery> {
  constructor(
    @InjectRepository(MissionAssignmentEntity)
    private readonly missionAssignmentRepository: Repository<MissionAssignmentEntity>,
    private readonly rulesCache: RulesCache,
  ) {}

  async execute(
    query: GetLatestMissionAssignmentsQuery,
  ): Promise<AssignmentDto[]> {
    const xpStatus = this.rulesCache
      .get('MissionCompleted')
      .some((rule) => rule.action === 'GrantXP');
    const assignments = await this.missionAssignmentRepository.find({
      where: { employeeId: query.employeeId, status: 'ASSIGNED' },
      relations:  {mission : true},
      order: { assignedAt: 'DESC' },
      take: 5,
    });
    return assignments.map((a) => new AssignmentDto(a, xpStatus));
  }
}