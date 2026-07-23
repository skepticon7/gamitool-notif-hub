export class UpdateEventLinkCommand {
  constructor(
    public readonly id: string,
    public readonly sourceEvent?: string,
    public readonly action?: string,
    public readonly params?: Record<string, any>,
    public readonly targetEvent?: string | null,
  ) {}
}
