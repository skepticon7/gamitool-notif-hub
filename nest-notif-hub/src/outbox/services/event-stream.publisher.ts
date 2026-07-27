import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { EVENT_STREAM, REDIS_CLIENT } from '../../shared/redis/redis.constants';
import { OutboxEntity } from '../entities/outbox.entity';

// Approximate cap so replays (which add brand-new entries per republish,
// since XADD '*' never dedupes) can't grow the stream without bound.
const STREAM_MAXLEN = 10_000;

@Injectable()
export class EventStreamPublisher {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async publish(event: OutboxEntity): Promise<string> {
    return this.redis.xadd(
      EVENT_STREAM,
      'MAXLEN',
      '~',
      STREAM_MAXLEN,
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
