export class CreateBadgeCommand {
  constructor(
    public readonly name: string,
    public readonly threshold: number,
    public readonly description?: string,
  ) {}
}
