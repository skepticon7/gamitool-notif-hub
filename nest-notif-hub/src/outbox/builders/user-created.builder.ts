import {  Injectable } from '@nestjs/common';
import { OutboxEventBuilder } from './outbox-event.builder';
import { OutboxEntity } from '../entities/outbox.entity';
import { UserCreatedEvent } from '../../users/events/user-created.event';
import { UserEntity } from '../../users/entities/user.entity';

@Injectable()
export class UserCreatedBuilder implements OutboxEventBuilder {
  eventType: string = "UserCreated";
  build(event: OutboxEntity): object {
    const payload : Record<string, any> = event.payload ;
    return new UserCreatedEvent(
      event.eventId,
      event.occurredOn,
      payload.id,
      payload.email,
      payload.name,
      payload.sub,
    )
  }
}