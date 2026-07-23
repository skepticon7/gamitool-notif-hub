export class AssignMissionCommand {
  constructor(
    public readonly missionId: string,
    public readonly employeeId : string
  ) {}
}