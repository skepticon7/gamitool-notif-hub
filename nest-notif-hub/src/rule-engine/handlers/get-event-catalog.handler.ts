import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetEventCatalogQuery } from '../queries/get-event-catalog.query';
import { EventCatalogEntity } from '../entities/event-catalog.entity';

@QueryHandler(GetEventCatalogQuery)
export class GetEventCatalogHandler implements IQueryHandler<GetEventCatalogQuery> {
  constructor(
    @InjectRepository(EventCatalogEntity)
    private readonly repo: Repository<EventCatalogEntity>,
  ) {}

  execute() {
    return this.repo.find();
  }
}
