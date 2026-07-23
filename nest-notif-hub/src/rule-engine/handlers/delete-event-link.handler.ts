import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeleteEventLinkCommand } from '../commands/delete-event-link.command';
import { EventLinkEntity } from '../entities/event-link.entity';
import { RulesCache } from '../services/rules-cache';

@CommandHandler(DeleteEventLinkCommand)
export class DeleteEventLinkHandler implements ICommandHandler<DeleteEventLinkCommand> {
  constructor(
    @InjectRepository(EventLinkEntity)
    private readonly repo: Repository<EventLinkEntity>,
    private readonly rulesCache: RulesCache,
  ) {}

  async execute(command: DeleteEventLinkCommand) {
    await this.repo.delete(command.id);
    await this.rulesCache.reload();
    return { deleted: true };
  }
}
