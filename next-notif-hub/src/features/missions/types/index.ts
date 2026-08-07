export interface Mission {
    id: string;
    name: string;
    xpGranted: number;
    durationDays: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateMissionInput {
    name: string;
    xpGranted: number;
    durationDays?: number;
}

export type UpdateMissionInput = Partial<CreateMissionInput>;

export type MissionAssignmentStatus = 'ASSIGNED' | 'COMPLETED' | 'EXPIRED';

// Matches MissionSummaryDto on the backend.
export interface AssignedMissionSummary {
    name: string;
    xpGranted: number;
    durationDays: number | null;
}

// Matches AssignmentDto on the backend — one shared DTO for
// GET /missions/my-assignments, GET /missions/assignments/latest, and the
// mission:assigned socket push, so this type is safe to use for all three
// with no per-surface narrowing or optionality. `xpStatus` is true only if
// the admin's rule graph actually wires MissionCompleted -> GrantXP —
// completing a mission never guarantees XP, so the UI is always told
// explicitly rather than assuming `xpGranted` will land.
export interface MissionAssignment {
    id: string;
    missionId: string;
    employeeId: string;
    status: MissionAssignmentStatus;
    assignedAt: string;
    completedAt: string | null;
    deadline: string | null;
    mission: AssignedMissionSummary;
    xpStatus: boolean;
}
