import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateEventLinkCommand } from '../commands/update-event-link.command';
import { EventLinkEntity } from '../entities/event-link.entity';
import { RulesCache } from '../services/rules-cache';
import { BusinessException } from '../../shared/exceptions/business.exception';
import { EventLinkGraphValidator } from '../services/event-link-graph-validator.service';

@CommandHandler(UpdateEventLinkCommand)
export class UpdateEventLinkHandler implements ICommandHandler<UpdateEventLinkCommand> {
  constructor(
    @InjectRepository(EventLinkEntity)
    private readonly repo: Repository<EventLinkEntity>,
    private readonly rulesCache: RulesCache,
    private readonly validator: EventLinkGraphValidator,
  ) {}

  async execute(command: UpdateEventLinkCommand) {
    const existing = await this.repo.findOneBy({ id: command.id });
    if (!existing) {
      throw new BusinessException(
        'EVENT_LINK_NOT_FOUND',
        `event_links row ${command.id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.validator.validate({
      sourceEvent: command.sourceEvent ?? existing.sourceEvent,
      action: command.action ?? existing.action,
      targetEvent: command.targetEvent !== undefined ? command.targetEvent : existing.targetEvent,
      params: command.params ?? existing.params,
      excludeLinkId: existing.id,
    });

    const changes: Partial<EventLinkEntity> = {
      ...(command.sourceEvent !== undefined && { sourceEvent: command.sourceEvent }),
      ...(command.action !== undefined && { action: command.action }),
      ...(command.params !== undefined && { params: command.params }),
      ...(command.targetEvent !== undefined && { targetEvent: command.targetEvent }),
    };

    // TypeORM's update() throws a raw QueryFailedError ("update values are
    // not defined") if given an empty set — surface it as a clean 400 rather
    // than a 500, since a no-field PATCH is a client mistake, not a server bug.
    if (Object.keys(changes).length === 0) {
      throw new BusinessException(
        'EMPTY_UPDATE',
        'PATCH body must include at least one field to update',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.repo.update(command.id, changes);
    await this.rulesCache.reload();
    return this.repo.findOneBy({ id: command.id });
  }
}
