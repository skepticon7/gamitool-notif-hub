import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeleteEventCatalogCommand } from '../commands/delete-event-catalog.command';
import { EventCatalogEntity } from '../entities/event-catalog.entity';

@CommandHandler(DeleteEventCatalogCommand)
export class DeleteEventCatalogHandler implements ICommandHandler<DeleteEventCatalogCommand> {
  constructor(
    @InjectRepository(EventCatalogEntity)
    private readonly repo: Repository<EventCatalogEntity>,
  ) {}

  async execute(command: DeleteEventCatalogCommand) {
    await this.repo.delete({ eventType: command.eventType });
    return { deleted: true };
  }
}
