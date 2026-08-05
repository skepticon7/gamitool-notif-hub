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

// The embedded subset both the REST relation (GetMyMissionAssignmentsHandler,
// after the relations:['mission'] fix) and the `mission:assigned` socket
// push carry — see docs/mission-assignment-relation-backend-prompt.md.
// `xpStatus` (backend TBD) is true only if the admin's rule graph actually
// wires this mission's completion to GrantXP — completing a mission never
// guarantees XP, since that mapping is entirely admin-configurable, so the
// UI can't just assume `xpGranted` will land and must be told explicitly.
export interface AssignedMissionSummary {
    name: string;
    xpGranted: number;
    durationDays: number | null;
}

export interface MissionAssignment {
    id: string;
    missionId: string;
    employeeId: string;
    status: MissionAssignmentStatus;
    assignedAt: string;
    completedAt: string | null;
    deadline: string | null;
    mission?: AssignedMissionSummary;
    // Optional — GetLatestMissionAssignmentsHandler doesn't send this yet
    // (backend TBD), unlike the mission:assigned socket push which already
    // does. Default to false when absent rather than assuming XP is wired.
    xpStatus?: boolean;
}

// The exact shape the "Active missions" dashboard panel needs, and exactly
// what the `mission:assigned` socket event pushes — a deliberately narrower
// type than MissionAssignment so REST rows (mapped down) and live socket
// pushes (already this shape) can share one merge without a field mismatch.
export interface ActiveMissionSummary {
    id: string;
    deadline: string | null;
    xpStatus: boolean;
    mission: AssignedMissionSummary;
}
