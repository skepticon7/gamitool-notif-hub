import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional } from 'class-validator';
import type { AssignmentStatus } from '../entities/mission-assignment.entity';

export class MissionAssignmentFiltersDto {
  @IsOptional()
  @IsIn(['ASSIGNED', 'EXPIRED', 'COMPLETED'])
  status?: AssignmentStatus;
}
