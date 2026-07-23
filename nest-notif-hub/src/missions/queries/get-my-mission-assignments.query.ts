import { AssignmentStatus } from '../entities/mission-assignment.entity';

// User-facing — employeeId is required and scopes the result to just their
// own assignments. See [[employee-identity-not-linked-to-auth]]: for now
// employeeId is passed explicitly by the caller rather than derived from an
// authenticated session, since User (OIDC login) and Employee (gamification
// persona) aren't linked yet.
export class GetMyMissionAssignmentsQuery {
  constructor(
    public readonly employeeId: string,
    public readonly status?: AssignmentStatus,
    public readonly assignedFrom?: Date,
    public readonly assignedTo?: Date,
    public readonly completedFrom?: Date,
    public readonly completedTo?: Date,
  ) {}
}
