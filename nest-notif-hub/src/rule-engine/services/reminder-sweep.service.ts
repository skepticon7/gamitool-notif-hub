import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ScheduledReminderEntity } from '../entities/scheduled-reminder.entity';
import { OutboxRepository } from '../../outbox/repositories/outbox.repository';
import { MissionEntity } from '../../missions/entities/mission.entity';

const SWEEP_BATCH_SIZE = 100;

// Materializes due, uncancelled reminders into real 'ReminderDue' outbox
// events — turning a durable MySQL fact into something the normal rule
// engine pipeline can pick up, exactly like any other event. This is what
// lets reminders be "just another event" that Notify (or anything else)
// can be wired to, instead of a separate delivery mechanism.
@Injectable()
export class ReminderSweepService {
  private readonly logger = new Logger(ReminderSweepService.name);

  constructor(
    @InjectRepository(ScheduledReminderEntity)
    private readonly reminderRepo: Repository<ScheduledReminderEntity>,
    private readonly outboxRepository: OutboxRepository,
    @InjectRepository(MissionEntity)
    private readonly missionRepository: Repository<MissionEntity>,
    private readonly dataSource: DataSource,
  ) {}

  @Interval(5000)
  async sweep() {
    const due = await this.claimDueBatch();
    if (due.length === 0) return;

    this.logger.log(`Firing ${due.length} due reminder(s)`);
    for (const reminder of due) {
      await this.fire(reminder);
    }
  }

  // Same SKIP LOCKED pattern as OutboxRepository.claimPendingBatch — lets a
  // second sweep instance run without double-firing the same reminder.
  private async claimDueBatch(): Promise<ScheduledReminderEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      return manager
        .createQueryBuilder(ScheduledReminderEntity, 'reminder')
        .where('reminder.status = :status', { status: 'PENDING' })
        .andWhere('reminder.fireAt <= NOW()')
        .orderBy('reminder.fireAt', 'ASC')
        .limit(SWEEP_BATCH_SIZE)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();
    });
  }

  private async fire(reminder: ScheduledReminderEntity) {
    try {
      // The emitted event and the SENT mark commit together or not at all —
      // same lesson as RuleEngineConsumer: a crash between the two must
      // never leave a fired reminder unrecorded (which would fire it twice
      // on the next sweep) or a SENT mark with no event actually created.
      await this.dataSource.transaction(async (manager) => {
        await this.outboxRepository.create(manager, {
          eventType: 'ReminderDue',
          eventId: randomUUID(),
          correlationId: randomUUID(), // new root — nothing upstream to inherit
          causationId: null,
          payload: reminder.payload,
          occurredOn: new Date(),
        });
        await manager.update(ScheduledReminderEntity, reminder.id, {
          status: 'SENT',
        });
      });
      this.logger.log(`Reminder ${reminder.id} fired -> ReminderDue`);
    } catch (error) {
      this.logger.error(
        `Failed to fire reminder ${reminder.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
