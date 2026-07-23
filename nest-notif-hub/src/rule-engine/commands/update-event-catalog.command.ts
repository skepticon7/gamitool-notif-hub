export class UpdateEventCatalogCommand {
  constructor(
    public readonly eventType: string,
    public readonly payloadFields?: Record<string, string>,
  ) {}
}
