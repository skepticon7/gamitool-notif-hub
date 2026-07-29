import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventCatalogEntity } from '../entities/event-catalog.entity';
import { EVENT_CATALOG_SEED } from '../event-catalog.seed';

@Injectable()
export class EventCatalogSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EventCatalogSeedService.name);

  constructor(
    @InjectRepository(EventCatalogEntity)
    private readonly catalogRepo: Repository<EventCatalogEntity>,
  ) {}

  async onApplicationBootstrap() {
    for (const entry of EVENT_CATALOG_SEED) {
      // save() with the primary key (eventType) already set upserts —
      // inserts if new, updates payloadFields if it already exists. Keeps
      // the table in sync with this file on every restart, no manual step.
      await this.catalogRepo.save(entry);
    }
    this.logger.log(`Event catalog seeded — ${EVENT_CATALOG_SEED.length} event type(s)`);
  }
}
