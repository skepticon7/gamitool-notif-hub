import { Inject, Injectable } from '@nestjs/common';
import Redis, { ChainableCommander } from 'ioredis';
import { EVENT_STREAM, REDIS_CLIENT } from '../../shared/redis/redis.constants';
import { OutboxEntity } from '../entities/outbox.entity';

// Approximate cap so replays (which add brand-new entries per republish,
// since XADD '*' never dedupes) can't grow the stream without bound.
const STREAM_MAXLEN = 10_000;

@Injectable()
export class EventStreamPublisher {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private fields(event: OutboxEntity): (string | number)[] {
    return [
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
    ];
  }

  async publish(event: OutboxEntity): Promise<string> {
    return this.redis.xadd(...(this.fields(event) as [string, ...string[]])) as Promise<string>;
  }

  // Queues an XADD onto a caller-owned pipeline instead of sending it
  // immediately — lets OutboxProcessor batch a whole claimed batch's worth
  // of events into one round trip instead of one per event.
  queue(pipeline: ChainableCommander, event: OutboxEntity): void {
    pipeline.xadd(...(this.fields(event) as [string, ...string[]]));
  }

  createPipeline(): ChainableCommander {
    return this.redis.pipeline();
  }
}
