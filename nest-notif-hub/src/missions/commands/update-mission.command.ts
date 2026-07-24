export class UpdateMissionCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly xpGranted?: number,
    public readonly durationDays?: number | null,
  ) {}
}
