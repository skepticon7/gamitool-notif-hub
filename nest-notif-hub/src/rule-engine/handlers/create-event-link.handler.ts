import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEventLinkCommand } from '../commands/create-event-link.command';
import { EventLinkEntity } from '../entities/event-link.entity';
import { RulesCache } from '../services/rules-cache';
import { EventLinkGraphValidator } from '../services/event-link-graph-validator.service';

@CommandHandler(CreateEventLinkCommand)
export class CreateEventLinkHandler implements ICommandHandler<CreateEventLinkCommand> {
  constructor(
    @InjectRepository(EventLinkEntity)
    private readonly repo: Repository<EventLinkEntity>,
    private readonly rulesCache: RulesCache,
    private readonly validator: EventLinkGraphValidator,
  ) {}

  async execute(command: CreateEventLinkCommand) {
    await this.validator.validate({
      sourceEvent: command.sourceEvent,
      action: command.action,
      targetEvent: command.targetEvent ?? null,
    });

    const saved = await this.repo.save(
      this.repo.create({
        sourceEvent: command.sourceEvent,
        action: command.action,
        params: command.params,
        targetEvent: command.targetEvent ?? null,
      }),
    );
    // Live on the next event processed, before this response even returns —
    // see rules-cache.ts for why a direct reload is enough here.
    await this.rulesCache.reload();
    return saved;
  }
}
