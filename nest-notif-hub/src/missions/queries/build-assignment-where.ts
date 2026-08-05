import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AssignmentStatus, MissionAssignmentEntity } from '../entities/mission-assignment.entity';

interface AssignmentFilters {
  status?: AssignmentStatus;

}

export function buildAssignmentWhere(
  filters: AssignmentFilters,
): FindOptionsWhere<MissionAssignmentEntity> {
  const where: FindOptionsWhere<MissionAssignmentEntity> = {};

  if (filters.status) {
    where.status = filters.status;
  } else {
    return {};
  }

  return where;
}
