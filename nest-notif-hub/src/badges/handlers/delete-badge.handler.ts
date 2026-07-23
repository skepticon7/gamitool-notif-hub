import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeleteBadgeCommand } from '../commands/delete-badge.command';
import { BadgeEntity } from '../entities/badge.entity';

@CommandHandler(DeleteBadgeCommand)
export class DeleteBadgeHandler implements ICommandHandler<DeleteBadgeCommand> {
  constructor(
    @InjectRepository(BadgeEntity)
    private readonly badgeRepo: Repository<BadgeEntity>,
  ) {}

  async execute(command: DeleteBadgeCommand) {
    await this.badgeRepo.delete({ id: command.id });
    return { deleted: true };
  }
}
