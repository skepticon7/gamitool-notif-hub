import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEventCatalogCommand } from '../commands/create-event-catalog.command';
import { EventCatalogEntity } from '../entities/event-catalog.entity';

@CommandHandler(CreateEventCatalogCommand)
export class CreateEventCatalogHandler implements ICommandHandler<CreateEventCatalogCommand> {
  constructor(
    @InjectRepository(EventCatalogEntity)
    private readonly repo: Repository<EventCatalogEntity>,
  ) {}

  execute(command: CreateEventCatalogCommand) {
    return this.repo.save(
      this.repo.create({
        eventType: command.eventType,
        payloadFields: command.payloadFields,
      }),
    );
  }
}
