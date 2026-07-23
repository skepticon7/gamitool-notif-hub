export class CreateEventLinkCommand {
  constructor(
    public readonly sourceEvent: string,
    public readonly action: string,
    public readonly params: Record<string, any>,
    public readonly targetEvent?: string,
  ) {}
}
