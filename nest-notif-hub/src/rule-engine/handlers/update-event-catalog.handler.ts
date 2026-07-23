import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateEventCatalogCommand } from '../commands/update-event-catalog.command';
import { EventCatalogEntity } from '../entities/event-catalog.entity';
import { BusinessException } from '../../shared/exceptions/business.exception';

@CommandHandler(UpdateEventCatalogCommand)
export class UpdateEventCatalogHandler implements ICommandHandler<UpdateEventCatalogCommand> {
  constructor(
    @InjectRepository(EventCatalogEntity)
    private readonly repo: Repository<EventCatalogEntity>,
  ) {}

  async execute(command: UpdateEventCatalogCommand) {
    const existing = await this.repo.findOneBy({ eventType: command.eventType });
    if (!existing) {
      throw new BusinessException(
        'EVENT_CATALOG_NOT_FOUND',
        `event_catalog row "${command.eventType}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.repo.update(
      { eventType: command.eventType },
      { ...(command.payloadFields !== undefined && { payloadFields: command.payloadFields }) },
    );
    return this.repo.findOneBy({ eventType: command.eventType });
  }
}
