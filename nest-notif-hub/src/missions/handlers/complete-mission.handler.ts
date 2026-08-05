import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CompleteMissionCommand } from '../commands/complete-mission.command';
import { OutboxRepository } from '../../outbox/repositories/outbox.repository';
import { DataSource, Repository } from 'typeorm';
import { QueryCacheInvalidator } from '../../shared/cache/query-cache-invalidator.service';
import { InjectRepository } from '@nestjs/typeorm';
import { MissionAssignmentEntity } from '../entities/mission-assignment.entity';
import { BusinessException } from '../../shared/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

@CommandHandler(CompleteMissionCommand)
export class CompleteMissionHandler implements ICommandHandler<CompleteMissionCommand> {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MissionAssignmentEntity)
    private readonly missionAssignmentRepository: Repository<MissionAssignmentEntity>,
    private readonly outboxRepository: OutboxRepository,
    private readonly queryCacheInvalidator: QueryCacheInvalidator,
  ) {}

  async execute(command: CompleteMissionCommand) {
    // Load the mission through the relation (needed for xpGranted, which
    // only exists on MissionEntity) — a separate "does the mission exist"
    // check would be validating something the FK constraint on missionId
    // already guarantees can never be false. employeeId is read as a plain
    // scalar; no need to load the full employee relation for just its id.
    const assignment = await this.missionAssignmentRepository.findOne({
      where: { id: command.assignmentId },
      relations: { mission: true },
    });
    if (!assignment) {
      throw new BusinessException(
        'NOT_FOUND',
        `Assignment with id : ${command.assignmentId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (assignment.status !== 'ASSIGNED') {
      throw new BusinessException(
        'BAD_REQUEST',
        'Assignment not assigned',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Owner-or-admin: an employee can only complete their own assignment;
    // an admin can complete anyone's. This is why the command carries
    // caller identity instead of just the assignmentId — the FK/status
    // checks above don't tell us who is allowed to make this call.
    if (!command.isAdmin && assignment.employeeId !== command.callerEmployeeId) {
      throw new BusinessException(
        'FORBIDDEN',
        'You are not allowed to complete this assignment',
        HttpStatus.FORBIDDEN,
      );
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      await manager.update(
        MissionAssignmentEntity,
        { id: command.assignmentId },
        { status: 'COMPLETED', completedAt: new Date() },
      );

      await this.outboxRepository.create(manager, {
        eventType: 'MissionCompleted',
        eventId: randomUUID(),
        correlationId: randomUUID(), // root event, no parent
        causationId: null,
        aggregateType: 'Mission',
        aggregateId: assignment.missionId,
        occurredOn: new Date(),
        payload: {
          employeeId: assignment.employeeId,
          missionId: assignment.missionId,
          xpGranted: assignment.mission.xpGranted,
          missionName: assignment.mission.name
        },
      });

      return manager.findOneBy(MissionAssignmentEntity, { id: command.assignmentId });
    });
    await this.outboxRepository.notifyWake();

    // Only after the transaction has actually committed — otherwise we'd
    // clear the cache for a write that might still roll back.
    await this.queryCacheInvalidator.invalidate('GetMissionAssignmentsQuery');
    await this.queryCacheInvalidator.invalidate('GetMyMissionAssignmentsQuery');

    return updated;
  }
}