export class CompleteMissionCommand {
  constructor(
    public readonly assignmentId: string,
    // Caller identity for the owner-or-admin check in CompleteMissionHandler —
    // callerEmployeeId is null when the caller has no linked Employee row.
    public readonly callerEmployeeId: string | null,
    public readonly isAdmin: boolean,
  ) {}
}
