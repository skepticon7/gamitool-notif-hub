import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpStatus } from '@nestjs/common';
import { UpdateSchedulmentCommand } from '../commands/update-schedulment.command';
import { MissionSchedulmentEntity } from '../entities/mission-schedulment.entity';
import { BusinessException } from '../../shared/exceptions/business.exception';
import { computeNextRecurrence } from '../services/compute-next-recurrence';

@CommandHandler(UpdateSchedulmentCommand)
export class UpdateSchedulmentHandler implements ICommandHandler<UpdateSchedulmentCommand> {
  constructor(
    @InjectRepository(MissionSchedulmentEntity)
    private readonly schedulmentRepo: Repository<MissionSchedulmentEntity>,
  ) {}

  async execute(command: UpdateSchedulmentCommand) {
    const existing = await this.schedulmentRepo.findOneBy({ id: command.id });
    if (!existing) {
      throw new BusinessException(
        'SCHEDULMENT_NOT_FOUND',
        `Schedulment ${command.id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (command.employeeIds !== undefined && existing.scope !== 'specific') {
      throw new BusinessException(
        'INVALID_SCOPE',
        'employeeIds can only be set on a "specific"-scope schedulment',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.schedulmentRepo.update(
      { id: command.id },
      {
        ...(command.recurrenceInterval !== undefined && {
          recurrenceInterval: command.recurrenceInterval,
          // Changing the cadence restarts it cleanly from now, rather than
          // trying to preserve the old interval's phase against a new one.
          nextRecurrenceAt: computeNextRecurrence(new Date(), command.recurrenceInterval),
        }),
        ...(command.employeeIds !== undefined && { employeeIds: command.employeeIds }),
      },
    );

    return this.schedulmentRepo.findOneBy({ id: command.id });
  }
}
