import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { OutboxRepository } from '../repositories/outbox.repository';
import { EventStreamPublisher } from './event-stream.publisher';
import { OutboxEntity } from '../entities/outbox.entity';
import { OUTBOX_WAKE_CHANNEL, REDIS_WAKE_CLIENT } from '../../shared/redis/redis.constants';

const BATCH_SIZE = 100;
const REPLAY_HOURS = 24;

@Injectable()
export class OutboxProcessor implements OnModuleInit {
  private readonly logger = new Logger(OutboxProcessor.name);
  // Two flags instead of one `running` boolean: `draining` guards against
  // overlapping drains, `dirty` remembers that a wake signal arrived while
  // one was already in flight, so it gets one more pass instead of being
  // dropped — see drain() below.
  private draining = false;
  private dirty = false;

  constructor(
    private readonly repository: OutboxRepository,
    private readonly publisher: EventStreamPublisher,
    @Inject(REDIS_WAKE_CLIENT) private readonly wakeClient: Redis,
  ) {}

  async onModuleInit() {
    // Fires on the initial connect AND every reconnect. A wake message can
    // only be lost if this connection was down at publish time — draining
    // on every 'ready' closes exactly that window, which is what lets this
    // run with no periodic timer at all.
    this.wakeClient.on('ready', () => {
      this.logger.log('Wake connection (re)established — draining any pending events');
      void this.drain();
    });
    this.wakeClient.on('message', (channel: string) => {
      if (channel === OUTBOX_WAKE_CHANNEL) void this.drain();
    });
    await this.wakeClient.subscribe(OUTBOX_WAKE_CHANNEL);
    this.logger.log(`Subscribed to "${OUTBOX_WAKE_CHANNEL}" — no periodic poll running`);

    // Catches anything left PENDING from before this process booted (e.g.
    // after a restart) — a one-time startup check, not a recurring poll.
    await this.drain();
  }

  // Drains every currently-pending row, coalescing any wake signals that
  // arrive mid-drain into at most one extra pass instead of one drain per
  // signal — matters at burst scale (e.g. a bulk mission assignment firing
  // dozens of notifyWake() calls in quick succession) and closes the race
  // where a signal landing right as the last empty check runs would
  // otherwise be silently missed.
  async drain() {
    if (this.draining) {
      this.dirty = true;
      return;
    }
    this.draining = true;
    try {
      do {
        this.dirty = false;
        let batch: OutboxEntity[];
        do {
          batch = await this.repository.claimPendingBatch(BATCH_SIZE);
          if (batch.length === 0) break;
          this.logger.log(`Publishing ${batch.length} pending event(s)`);
          await this.publishBatch(batch);
        } while (batch.length === BATCH_SIZE);
      } while (this.dirty);
    } finally {
      this.draining = false;
    }
  }

  // Recovery-only path: called when a stream consumer's read loop errors
  // out (e.g. Redis dropped the stream/group). Republishes everything from
  // the window regardless of status and leaves outbox status untouched,
  // since the outbox side already delivered these successfully — only the
  // stream needs refilling.
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

  // Pipelines the whole batch's XADDs into one round trip, then marks
  // successes with one bulk UPDATE — instead of a sequential XADD+UPDATE
  // pair per event, which is what made a large burst slow to drain.
  private async publishBatch(batch: OutboxEntity[]) {
    const pipeline = this.publisher.createPipeline();
    for (const event of batch) this.publisher.queue(pipeline, event);

    let results: [Error | null, unknown][];
    try {
      results = ((await pipeline.exec()) ?? []) as [Error | null, unknown][];
    } catch (error) {
      // Connection-level failure (e.g. Redis unreachable) — nothing in the
      // pipeline was acknowledged, so every event in the batch is retried.
      const message = error instanceof Error ? error.message : 'Unknown publish error';
      for (const event of batch) await this.repository.markFailed(event, message);
      this.logger.error(`Batch publish failed: ${message}`);
      return;
    }

    const succeeded: string[] = [];
    for (let i = 0; i < batch.length; i++) {
      const [err] = results[i] ?? [null];
      const event = batch[i];
      if (err) {
        await this.repository.markFailed(event, err.message);
        this.logger.error(`${event.eventType} publish failed: ${err.message}`);
      } else {
        succeeded.push(event.id);
      }
    }
    if (succeeded.length) {
      await this.repository.markProcessedBatch(succeeded);
      this.logger.log(`${succeeded.length} event(s) marked PROCESSED`);
    }
  }
}
