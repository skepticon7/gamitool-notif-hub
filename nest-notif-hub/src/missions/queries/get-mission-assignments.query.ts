import { AssignmentStatus } from '../entities/mission-assignment.entity';

// Admin-facing — no employeeId scoping, sees every assignment.
export class GetMissionAssignmentsQuery {
  constructor(
    public readonly status?: AssignmentStatus,
    public readonly assignedFrom?: Date,
    public readonly assignedTo?: Date,
    public readonly completedFrom?: Date,
    public readonly completedTo?: Date,
  ) {}
}
