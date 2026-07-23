import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateBadgeCommand } from '../commands/update-badge.command';
import { BadgeEntity } from '../entities/badge.entity';
import { BusinessException } from '../../shared/exceptions/business.exception';

@CommandHandler(UpdateBadgeCommand)
export class UpdateBadgeHandler implements ICommandHandler<UpdateBadgeCommand> {
  constructor(
    @InjectRepository(BadgeEntity)
    private readonly badgeRepo: Repository<BadgeEntity>,
  ) {}

  async execute(command: UpdateBadgeCommand) {
    const existing = await this.badgeRepo.findOneBy({ id: command.id });
    if (!existing) {
      throw new BusinessException(
        'BADGE_NOT_FOUND',
        `Badge ${command.id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.badgeRepo.update(
      { id: command.id },
      {
        ...(command.name !== undefined && { name: command.name }),
        ...(command.threshold !== undefined && { threshold: command.threshold }),
        ...(command.description !== undefined && { description: command.description }),
      },
    );
    return this.badgeRepo.findOneBy({ id: command.id });
  }
}
