import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AssignmentStatus, MissionAssignmentEntity } from '../entities/mission-assignment.entity';

interface AssignmentFilters {
  status?: AssignmentStatus;
  assignedFrom?: Date;
  assignedTo?: Date;
  completedFrom?: Date;
  completedTo?: Date;
}

export function buildAssignmentWhere(
  filters: AssignmentFilters,
): FindOptionsWhere<MissionAssignmentEntity> {
  const where: FindOptionsWhere<MissionAssignmentEntity> = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.assignedFrom && filters.assignedTo) {
    where.assignedAt = Between(filters.assignedFrom, filters.assignedTo);
  } else if (filters.assignedFrom) {
    where.assignedAt = MoreThanOrEqual(filters.assignedFrom);
  } else if (filters.assignedTo) {
    where.assignedAt = LessThanOrEqual(filters.assignedTo);
  }

  if (filters.completedFrom && filters.completedTo) {
    where.completedAt = Between(filters.completedFrom, filters.completedTo);
  } else if (filters.completedFrom) {
    where.completedAt = MoreThanOrEqual(filters.completedFrom);
  } else if (filters.completedTo) {
    where.completedAt = LessThanOrEqual(filters.completedTo);
  }

  return where;
}
