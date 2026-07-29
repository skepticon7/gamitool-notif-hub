import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { MissionSchedulmentEntity } from '../entities/mission-schedulment.entity';
import { BulkAssignMissionCommand } from '../commands/bulk-assign-mission.command';
import { computeNextRecurrence } from './compute-next-recurrence';

const SWEEP_BATCH_SIZE = 100;

// Same shape as MissionExpirySweepService/ReminderSweepService: @Interval
// poll, SKIP LOCKED batch claim, per-item try/catch so one bad schedulment
// never blocks the rest. Unlike those two (one-shot: fire once, done
// forever), firing here also computes the NEXT due time before moving on —
// that's what makes it recur instead of firing only once.
@Injectable()
export class MissionRecurrenceSweepService {
  private readonly logger = new Logger(MissionRecurrenceSweepService.name);

  constructor(
    @InjectRepository(MissionSchedulmentEntity)
    private readonly schedulmentRepo: Repository<MissionSchedulmentEntity>,
    private readonly dataSource: DataSource,
    private readonly commandBus: CommandBus,
  ) {}

  @Interval(60000)
  async sweep() {
    const due = await this.claimDueBatch();
    if (due.length === 0) return;

    this.logger.log(`Firing ${due.length} due schedulment(s)`);
    for (const schedulment of due) {
      await this.fire(schedulment);
    }
  }

  // Same SKIP LOCKED pattern as every other sweep in this codebase — lets a
  // second sweep instance run without double-firing the same schedulment.
  private async claimDueBatch(): Promise<MissionSchedulmentEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      return manager
        .createQueryBuilder(MissionSchedulmentEntity, 'schedulment')
        .where('schedulment.status = :status', { status: 'ACTIVE' })
        .andWhere('schedulment.nextRecurrenceAt <= NOW()')
        .orderBy('schedulment.nextRecurrenceAt', 'ASC')
        .limit(SWEEP_BATCH_SIZE)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();
    });
  }

  private async fire(schedulment: MissionSchedulmentEntity) {
    try {
      // BulkAssignMissionHandler runs its own N individual
      // AssignMissionCommand transactions (one per employee) plus its own
      // MissionBulkAssigned emission — not wrapped in a single outer
      // transaction here, same reasoning as the manual /assign-all endpoint
      // this reuses.
      await this.commandBus.execute(
        new BulkAssignMissionCommand(
          schedulment.missionId,
          schedulment.scope === 'specific' ? schedulment.employeeIds ?? [] : undefined,
        ),
      );

      await this.schedulmentRepo.update(
        { id: schedulment.id },
        { nextRecurrenceAt: computeNextRecurrence(new Date(), schedulment.recurrenceInterval) },
      );

      this.logger.log(`Schedulment ${schedulment.id} fired, rescheduled`);
    } catch (error) {
      this.logger.error(
        `Failed to fire schedulment ${schedulment.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
