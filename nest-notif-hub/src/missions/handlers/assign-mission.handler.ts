import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AssignMissionCommand } from '../commands/assign-mission.command';
import { DataSource, Repository } from 'typeorm';
import { OutboxRepository } from '../../outbox/repositories/outbox.repository';
import { QueryCacheInvalidator } from '../../shared/cache/query-cache-invalidator.service';
import { InjectRepository } from '@nestjs/typeorm';
import { MissionAssignmentEntity } from '../entities/mission-assignment.entity';
import { BusinessException } from '../../shared/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EmployeeUserEntity } from '../../users/entities/employee-user.entity';

@CommandHandler(AssignMissionCommand)
export class AssignMissionHandler implements ICommandHandler<AssignMissionCommand> {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(EmployeeUserEntity)
    private readonly employeeUserEntityRepository: Repository<EmployeeUserEntity>,
    private readonly outboxRepository: OutboxRepository,
    @InjectRepository(MissionAssignmentEntity)
    private readonly missionAssignmentRepo: Repository<MissionAssignmentEntity>,
    private readonly queryCacheInvalidator: QueryCacheInvalidator,
  ) {}

  async execute(command: AssignMissionCommand) {
    const employeeCheck = await this.employeeUserEntityRepository.findOneBy({
      id: command.employeeId,
    });

    if (!employeeCheck) {
      throw new BusinessException(
        'NOT_FOUND',
        `Employee with id : ${command.employeeId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const assignmentCheck = await this.missionAssignmentRepo.findOneBy({
      missionId: command.missionId,
      employeeId: command.employeeId,
      status: 'ASSIGNED',
    });

    if (assignmentCheck) {
      throw new BusinessException(
        'ALREADY_EXISTS',
        'Assigned mission already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    const assignmentId = randomUUID();

    // Both writes commit together or not at all — same reasoning as every
    // other transaction in this codebase: a crash between them must never
    // leave an outbox event with no assignment row behind it, or vice versa.
    const assignment = await this.dataSource.transaction(async (manager) => {
      // insert(), with flat scalar values — not save(create()) with
      // relation objects, which is confirmed to swap values between the
      // two FK columns in this TypeORM version. See entity comment.
      await manager.insert(MissionAssignmentEntity, {
        id: assignmentId,
        missionId: command.missionId,
        employeeId: command.employeeId,
        status: 'ASSIGNED',
        assignedAt: new Date(),
        completedAt: null,
      });

      await this.outboxRepository.create(manager, {
        eventType: 'MissionAssigned',
        eventId: randomUUID(),
        correlationId: randomUUID(), // root event, no parent
        causationId: null,
        aggregateType: 'Mission',
        aggregateId: command.missionId,
        occurredOn: new Date(),
        payload: {
          employeeId: command.employeeId,
          missionId: command.missionId,
        },
      });

      return manager.findOneBy(MissionAssignmentEntity, { id: assignmentId });
    });

    // Only after the transaction has actually committed — otherwise we'd
    // clear the cache for a write that might still roll back.
    await this.queryCacheInvalidator.invalidate('GetMissionAssignmentsQuery');
    await this.queryCacheInvalidator.invalidate('GetMyMissionAssignmentsQuery');

    return assignment;
  }
}