export class CreateMissionCommand {
  constructor(
    public readonly name: string,
    public readonly xpGranted: number,
  ) {}
}
