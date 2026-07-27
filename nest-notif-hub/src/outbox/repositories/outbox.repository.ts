import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxEntity } from '../entities/outbox.entity';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BusinessException } from '../../shared/exceptions/business.exception';

export const OUTBOX_MAX_ATTEMPTS = 5;

@Injectable()
export class OutboxRepository {
  constructor(
    @InjectRepository(OutboxEntity)
    private readonly repository: Repository<OutboxEntity>,
    private readonly dataSource: DataSource,
  ) {}

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

  async markFailed(entity: OutboxEntity, error: string) {
    const attempts = entity.attempts + 1;
    await this.repository.update(entity.id, {
      attempts,
      lastError: error.slice(0, 1000),
      status: attempts >= OUTBOX_MAX_ATTEMPTS ? 'DEAD' : 'PENDING',
    });
  }
}
