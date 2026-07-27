import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OutboxRepository } from '../repositories/outbox.repository';
import { EventStreamPublisher } from './event-stream.publisher';
import { OutboxEntity } from '../entities/outbox.entity';

const BATCH_SIZE = 100;
const REPLAY_HOURS = 24;

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

  // Recovery-only path: called when the rule-engine consumer's read loop
  // errors out (e.g. Redis dropped the stream/group). Republishes everything
  // from the window regardless of status and leaves outbox status untouched,
  // since the outbox side already delivered these successfully — only the
  // stream needs refilling. NOT wired into the 5s interval: doing that would
  // republish the whole window on every tick.
  async replayRecent(hours: number = REPLAY_HOURS) {
    const events = await this.repository.findRecentForReplay(hours);
    if (events.length === 0) return;

    this.logger.warn(`Replaying ${events.length} event(s) from the last ${hours}h`);
    for (const event of events) {
      try {
        await this.publisher.publish(event);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown replay error';
        this.logger.error(`${event.eventType} replay failed: ${message}`);
      }
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
