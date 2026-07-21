import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { EVENT_STREAM, REDIS_CLIENT } from '../../shared/redis/redis.constants';
import { OutboxEntity } from '../entities/outbox.entity';

@Injectable()
export class EventStreamPublisher {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async publish(event: OutboxEntity): Promise<string> {
    return this.redis.xadd(
      EVENT_STREAM,
      '*',
      'eventId',
      event.eventId,
      'eventType',
      event.eventType,
      'version',
      String(event.version),
      'occurredOn',
      event.occurredOn.toISOString(),
      'correlationId',
      event.correlationId,
      'causationId',
      event.causationId ?? '',
      'aggregateType',
      event.aggregateType ?? '',
      'aggregateId',
      event.aggregateId ?? '',
      'payload',
      JSON.stringify(event.payload),
    ) as Promise<string>;
  }
}
