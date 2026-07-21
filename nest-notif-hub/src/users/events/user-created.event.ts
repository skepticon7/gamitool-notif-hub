import { BaseDomainEvent } from '../../shared/events/domain-event';

export class UserCreatedEvent extends BaseDomainEvent {
  eventType: string = "UserCreated";
  constructor(
    eventId: string,
    occuredOn: Date,
    public readonly id: string,
    public readonly email: string,
    public readonly name: string,
    public readonly sub: string,
  ) {
    super(eventId , occuredOn);
  }
}