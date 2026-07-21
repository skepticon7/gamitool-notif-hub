import { randomUUID } from 'node:crypto';

export abstract class BaseDomainEvent {

  constructor(

    public readonly eventId: string,

    public readonly occurredOn: Date,

  ) {}

  abstract readonly eventType: string;

}