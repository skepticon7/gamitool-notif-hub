import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpStatus } from '@nestjs/common';
import { CancelSchedulmentCommand } from '../commands/cancel-schedulment.command';
import { MissionSchedulmentEntity } from '../entities/mission-schedulment.entity';
import { BusinessException } from '../../shared/exceptions/business.exception';

@CommandHandler(CancelSchedulmentCommand)
export class CancelSchedulmentHandler implements ICommandHandler<CancelSchedulmentCommand> {
  constructor(
    @InjectRepository(MissionSchedulmentEntity)
    private readonly schedulmentRepo: Repository<MissionSchedulmentEntity>,
  ) {}

  async execute(command: CancelSchedulmentCommand) {
    const existing = await this.schedulmentRepo.findOneBy({ id: command.id });
    if (!existing) {
      throw new BusinessException(
        'SCHEDULMENT_NOT_FOUND',
        `Schedulment ${command.id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.schedulmentRepo.update({ id: command.id }, { status: 'CANCELLED' });
    return { cancelled: true };
  }
}
