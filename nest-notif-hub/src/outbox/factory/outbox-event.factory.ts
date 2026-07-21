import { HttpStatus, Injectable } from '@nestjs/common';
import { OutboxEventBuilder } from '../builders/outbox-event.builder';
import { UserCreatedBuilder } from '../builders/user-created.builder';
import { OutboxEntity } from '../entities/outbox.entity';
import { BusinessException } from '../../shared/exceptions/business.exception';

@Injectable()
export class OutboxEventFactory {
  private readonly builders = new Map<string, OutboxEventBuilder>();

  constructor(private readonly userCreatedBuilder: UserCreatedBuilder) {
    this.builders.set(this.userCreatedBuilder.eventType, this.userCreatedBuilder);
  }

  create(event: OutboxEntity): object {
    const builder = this.builders.get(event.eventType);
    if (!builder) {
      throw new BusinessException(
        'NO_BUILDER_ERROR',
        `No builder found for ${event.eventType}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return builder.build(event);
  }
}