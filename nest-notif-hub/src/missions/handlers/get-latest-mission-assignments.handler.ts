import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetLatestMissionAssignmentsQuery } from '../queries/get-latest-mission-assignments.query';
import { InjectRepository } from '@nestjs/typeorm';
import { MissionAssignmentEntity } from '../entities/mission-assignment.entity';
import { Repository } from 'typeorm';

@QueryHandler(GetLatestMissionAssignmentsQuery)
export class GetLatestMissionAssignmentsHandler implements IQueryHandler<GetLatestMissionAssignmentsQuery> {
  constructor(
    @InjectRepository(MissionAssignmentEntity)
    private readonly missionAssignmentRepository: Repository<MissionAssignmentEntity>,
  ) {}

  async execute(
    query: GetLatestMissionAssignmentsQuery,
  ): Promise<MissionAssignmentEntity[]> {
    return this.missionAssignmentRepository.find({
      where: { employeeId: query.employeeId, status: 'ASSIGNED' },
      relations:  {mission : true},
      order: { assignedAt: 'DESC' },
      take: 5,
    });
  }
}