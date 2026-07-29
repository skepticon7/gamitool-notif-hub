import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateSchedulmentCommand } from '../commands/create-schedulment.command';
import { MissionEntity } from '../entities/mission.entity';
import { MissionSchedulmentEntity } from '../entities/mission-schedulment.entity';
import { BusinessException } from '../../shared/exceptions/business.exception';
import { computeNextRecurrence } from '../services/compute-next-recurrence';

@CommandHandler(CreateSchedulmentCommand)
export class CreateSchedulmentHandler implements ICommandHandler<CreateSchedulmentCommand> {
  constructor(
    @InjectRepository(MissionEntity)
    private readonly missionRepo: Repository<MissionEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: CreateSchedulmentCommand) {
    const mission = await this.missionRepo.findOneBy({ id: command.missionId });
    if (!mission) {
      throw new BusinessException(
        'NOT_FOUND',
        `Mission with id : ${command.missionId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (command.scope === 'specific' && (!command.employeeIds || command.employeeIds.length === 0)) {
      throw new BusinessException(
        'MISSING_EMPLOYEE_IDS',
        'scope "specific" requires at least one employeeId',
        HttpStatus.BAD_REQUEST,
      );
    }

    const id = randomUUID();
    // manager.insert() with flat scalar values — never save(create()) with
    // the relation object, see the entity's own comment for why.
    await this.dataSource.manager.insert(MissionSchedulmentEntity, {
      id,
      missionId: command.missionId,
      recurrenceInterval: command.recurrenceInterval,
      scope: command.scope,
      employeeIds: command.scope === 'specific' ? command.employeeIds! : null,
      nextRecurrenceAt: computeNextRecurrence(new Date(), command.recurrenceInterval),
      status: 'ACTIVE',
    });

    return this.dataSource.manager.findOneBy(MissionSchedulmentEntity, { id });
  }
}
