import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxEntity } from '../entities/outbox.entity';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { BusinessException } from '../../shared/exceptions/business.exception';
import Redis from 'ioredis';
import { OUTBOX_WAKE_CHANNEL, REDIS_CLIENT } from '../../shared/redis/redis.constants';

export const OUTBOX_MAX_ATTEMPTS = 5;

@Injectable()
export class OutboxRepository {
  constructor(
    @InjectRepository(OutboxEntity)
    private readonly repository: Repository<OutboxEntity>,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // Called after a caller's transaction commits (never from inside create(),
  // which runs mid-transaction) to wake OutboxProcessor immediately instead
  // of waiting on its next drain trigger. Fire-and-forget PUBLISH — safe to
  // reuse REDIS_CLIENT since it's not a blocking/subscribed command.
  async notifyWake() {
    await this.redis.publish(OUTBOX_WAKE_CHANNEL, '1');
  }

  create(manager: EntityManager, event: Partial<OutboxEntity>) {
    try {
      const entity = manager.create(OutboxEntity, event);
      return manager.save(entity);
    } catch (error) {
      throw new BusinessException(
        'MYSQL_ERROR',
        error instanceof Error ? error.message : 'Unknown Mysql error',
      );
    }
  }

  // Claims a batch inside a transaction so concurrent publishers never grab the
  // same rows. Returns rows already marked PROCESSED optimistically — the caller
  // must dead-letter on failure, since at-least-once is the contract here.
  async claimPendingBatch(limit: number): Promise<OutboxEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      const events = await manager
        .createQueryBuilder(OutboxEntity, 'outbox')
        .where('outbox.status = :status', { status: 'PENDING' })
        .orderBy('outbox.occurredOn', 'ASC')
        .limit(limit)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      return events;
    });
  }

  // Self-healing replay: pulls every event from the last `hours`, regardless
  // of status, so already-PROCESSED rows can be republished if Redis lost
  // them before AOF persisted the stream. Read-only on purpose — replay must
  // never touch status/attempts, or a transient republish failure would
  // corrupt the bookkeeping of an event that already delivered fine.
  async findRecentForReplay(hours: number): Promise<OutboxEntity[]> {
    return this.repository
      .createQueryBuilder('outbox')
      .where('outbox.occurredOn > NOW() - INTERVAL :hours HOUR', { hours })
      .getMany();
  }

  async markProcessed(entity: OutboxEntity) {
    await this.repository.update(entity.id, {
      status: 'PROCESSED',
      publishedAt: new Date(),
    });
  }

  // Batched equivalent of markProcessed for a whole claimed batch — one
  // round trip instead of one per event, since a bulk XADD pipeline succeeds
  // or fails as a set for the vast majority of cases.
  async markProcessedBatch(ids: string[]) {
    if (ids.length === 0) return;
    await this.repository.update({ id: In(ids) }, {
      status: 'PROCESSED',
      publishedAt: new Date(),
    });
  }

  async markFailed(entity: OutboxEntity, error: string) {
    const attempts = entity.attempts + 1;
    await this.repository.update(entity.id, {
      attempts,
      lastError: error.slice(0, 1000),
      status: attempts >= OUTBOX_MAX_ATTEMPTS ? 'DEAD' : 'PENDING',
    });
  }
}
