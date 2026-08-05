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
import { MissionEntity } from '../entities/mission.entity';

@CommandHandler(AssignMissionCommand)
export class AssignMissionHandler implements ICommandHandler<AssignMissionCommand> {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(EmployeeUserEntity)
    private readonly employeeUserEntityRepository: Repository<EmployeeUserEntity>,
    @InjectRepository(MissionEntity)
    private readonly missionRepo: Repository<MissionEntity>,
    private readonly outboxRepository: OutboxRepository,
    @InjectRepository(MissionAssignmentEntity)
    private readonly missionAssignmentRepo: Repository<MissionAssignmentEntity>,
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

    // Needed for its durationDays (to compute this assignment's deadline)
    // — also now doubles as a clean 404 for a bad missionId, instead of
    // relying on the FK constraint to reject the insert further down.
    const mission = await this.missionRepo.findOneBy({ id: command.missionId });
    if (!mission) {
      throw new BusinessException(
        'NOT_FOUND',
        `Mission with id : ${command.missionId} not found`,
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
    const assignedAt = new Date();
    // Computed once, here, from the mission's duration — not derived later
    // on read. See MissionAssignmentEntity.deadline for why.
    const deadline = mission.durationDays
      ? new Date(assignedAt.getTime() + mission.durationDays * 24 * 60 * 60 * 1000)
      : null;

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
        assignedAt,
        completedAt: null,
        deadline,
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
          deadline,
          employeeId: command.employeeId,
          missionId: command.missionId,
          missionName: mission.name,
          xpGranted: mission.xpGranted,
          assignmentId,
          durationDays: mission.durationDays,
        },
      });

      return manager.findOneBy(MissionAssignmentEntity, { id: assignmentId });
    });
    await this.outboxRepository.notifyWake();


    return assignment;
  }
}