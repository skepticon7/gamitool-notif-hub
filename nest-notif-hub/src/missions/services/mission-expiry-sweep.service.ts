import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository  } from '@nestjs/typeorm';
import { DataSource, Repository , In } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { MissionAssignmentEntity } from '../entities/mission-assignment.entity';
import { OutboxRepository } from '../../outbox/repositories/outbox.repository';
import { QueryCacheInvalidator } from '../../shared/cache/query-cache-invalidator.service';
import { MissionEntity } from '../entities/mission.entity';

const SWEEP_BATCH_SIZE = 100;

// Mirrors ReminderSweepService's shape exactly: turns a durable MySQL fact
// (an ASSIGNED row whose deadline has passed) into a real 'MissionExpired'
// outbox event, so expiry is "just another event" the rule engine can wire
// anything to (notify the employee, notify an admin, whatever), rather than
// a bespoke mechanism of its own.
@Injectable()
export class MissionExpirySweepService {
  private readonly logger = new Logger(MissionExpirySweepService.name);

  constructor(
    @InjectRepository(MissionAssignmentEntity)
    private readonly assignmentRepo: Repository<MissionAssignmentEntity>,
    private readonly outboxRepository: OutboxRepository,
    private readonly dataSource: DataSource,
    private readonly queryCacheInvalidator: QueryCacheInvalidator,
    @InjectRepository(MissionEntity)
    private readonly missionRepository : Repository<MissionEntity>
  ) {}

  @Interval(30000)
  async sweep() {
    const overdue = await this.claimOverdueBatch();
    if (overdue.length === 0) return;
    const missionIds: string[] = [...new Set(overdue.map((a) => a.missionId))];
    const missions: MissionEntity[] = await this.missionRepository.findBy({id: In(missionIds)});
    const missionNameById = new Map(missions.map((m) => [m.id , m.name]));
    this.logger.log(`Expiring ${overdue.length} overdue assignment(s)`);
    for (const assignment of overdue) {
      await this.expire(assignment , missionNameById.get(assignment.missionId));
    }
  }

  // Same SKIP LOCKED pattern as ReminderSweepService/OutboxRepository — lets
  // a second sweep instance run without double-expiring the same row.
  private async claimOverdueBatch(): Promise<MissionAssignmentEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      return manager
        .createQueryBuilder(MissionAssignmentEntity, 'assignment')
        .where('assignment.status = :status', { status: 'ASSIGNED' })
        .andWhere('assignment.deadline IS NOT NULL')
        .andWhere('assignment.deadline <= NOW()')
        .orderBy('assignment.deadline', 'ASC')
        .limit(SWEEP_BATCH_SIZE)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();
    });
  }

  private async expire(assignment: MissionAssignmentEntity , missionName? : string) {
    try {
      // The status flip and the emitted event commit together or not at
      // all — same reasoning as everywhere else: a crash between the two
      // must never leave a silently-expired row (no event) or an event
      // with no corresponding status change.
      await this.dataSource.transaction(async (manager) => {
        await manager.update(MissionAssignmentEntity, assignment.id, {
          status: 'EXPIRED',
        });
        await this.outboxRepository.create(manager, {
          eventType: 'MissionExpired',
          eventId: randomUUID(),
          correlationId: randomUUID(), // new root — nothing upstream to inherit
          causationId: null,
          aggregateType: 'Mission',
          aggregateId: assignment.missionId,
          occurredOn: new Date(),
          payload: {
            missionName,
            employeeId: assignment.employeeId,
            missionId: assignment.missionId,
            assignmentId: assignment.id,
          },
        });
      });

      await this.queryCacheInvalidator.invalidate('GetMissionAssignmentsQuery');
      await this.queryCacheInvalidator.invalidate('GetMyMissionAssignmentsQuery');

      this.logger.log(`Assignment ${assignment.id} expired -> MissionExpired`);
    } catch (error) {
      this.logger.error(
        `Failed to expire assignment ${assignment.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
