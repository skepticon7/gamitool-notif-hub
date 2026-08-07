import { MissionAssignmentEntity } from '../entities/mission-assignment.entity';

type AssignmentStatus = 'EXPIRED' | 'COMPLETED' | 'ASSIGNED';

export class MissionSummaryDto {
  name: string;
  xpGranted: number;
  durationDays: number | null;

  constructor(mission: {
    name: string;
    xpGranted: number;
    durationDays: number | null;
  }) {
    this.name = mission.name;
    this.xpGranted = mission.xpGranted;
    this.durationDays = mission.durationDays;
  }
}

export class AssignmentDto {
  id: string;
  missionId: string;
  employeeId: string;
  status: 'ASSIGNED' | 'COMPLETED' | 'EXPIRED';
  assignedAt: string;
  completedAt: string | null;
  deadline: string | null;
  mission: MissionSummaryDto;
  xpStatus: boolean;

  constructor(assignment: MissionAssignmentEntity, xpStatus: boolean) {
    this.id = assignment.id;
    this.missionId = assignment.missionId;
    this.employeeId = assignment.employeeId;
    this.status = assignment.status;
    this.assignedAt = assignment.assignedAt.toISOString();
    this.completedAt = assignment.completedAt?.toISOString() ?? null;
    this.deadline = assignment.deadline?.toISOString() ?? null;
    this.mission = new MissionSummaryDto(assignment.mission);
    this.xpStatus = xpStatus;
  }
}
