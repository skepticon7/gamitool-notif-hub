export class CreateEventCatalogCommand {
  constructor(
    public readonly eventType: string,
    public readonly payloadFields: Record<string, string>,
  ) {}
}
