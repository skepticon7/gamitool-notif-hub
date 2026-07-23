import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetEventLinksQuery } from '../queries/get-event-links.query';
import { EventLinkEntity } from '../entities/event-link.entity';

@QueryHandler(GetEventLinksQuery)
export class GetEventLinksHandler implements IQueryHandler<GetEventLinksQuery> {
  constructor(
    @InjectRepository(EventLinkEntity)
    private readonly repo: Repository<EventLinkEntity>,
  ) {}

  execute(query: GetEventLinksQuery) {
    return this.repo.find(
      query.sourceEvent ? { where: { sourceEvent: query.sourceEvent } } : {},
    );
  }
}
