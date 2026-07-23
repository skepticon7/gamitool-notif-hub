export class UpdateBadgeCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly threshold?: number,
    public readonly description?: string,
  ) {}
}
