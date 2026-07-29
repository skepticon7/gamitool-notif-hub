export class BulkAssignMissionCommand {
  constructor(
    public readonly missionId: string,
    // Omitted = everyone (existing "assign to all" behavior, unchanged).
    // Provided = only these employees — used by the recurrence sweep for
    // "specific"-scope schedulments.
    public readonly employeeIds?: string[],
  ) {}
}
