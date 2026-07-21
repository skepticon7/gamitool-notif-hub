import { OutboxEntity } from '../entities/outbox.entity';

export interface OutboxEventBuilder {
  eventType: string;
  build(event: OutboxEntity) : object;
}