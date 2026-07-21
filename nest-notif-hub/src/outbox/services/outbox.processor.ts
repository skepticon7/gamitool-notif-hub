import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OutboxRepository } from '../repositories/outbox.repository';
import { EventStreamPublisher } from './event-stream.publisher';
import { OutboxEntity } from '../entities/outbox.entity';

const BATCH_SIZE = 100;

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);
  private running = false;

  constructor(
    private readonly repository: OutboxRepository,
    private readonly publisher: EventStreamPublisher,
  ) {}

  @Interval(5000)
  async process() {
    // Guard against a slow batch overlapping the next tick.
    if (this.running) return;
    this.running = true;

    try {
      const events = await this.repository.claimPendingBatch(BATCH_SIZE);
      if (events.length === 0) return;

      this.logger.log(`Publishing ${events.length} pending event(s)`);
      for (const event of events) {
        await this.publish(event);
      }
    } finally {
      this.running = false;
    }
  }

  private async publish(event: OutboxEntity) {
    try {
      await this.publisher.publish(event);
      await this.repository.markProcessed(event);
      this.logger.log(`${event.eventType} published (${event.eventId})`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown publish error';
      await this.repository.markFailed(event, message);
      this.logger.error(`${event.eventType} publish failed: ${message}`);
    }
  }
}
