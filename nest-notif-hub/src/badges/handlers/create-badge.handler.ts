import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBadgeCommand } from '../commands/create-badge.command';
import { BadgeEntity } from '../entities/badge.entity';

@CommandHandler(CreateBadgeCommand)
export class CreateBadgeHandler implements ICommandHandler<CreateBadgeCommand> {
  constructor(
    @InjectRepository(BadgeEntity)
    private readonly badgeRepo: Repository<BadgeEntity>,
  ) {}

  execute(command: CreateBadgeCommand) {
    return this.badgeRepo.save(
      this.badgeRepo.create({
        name: command.name,
        threshold: command.threshold,
        description: command.description ?? null,
      }),
    );
  }
}
