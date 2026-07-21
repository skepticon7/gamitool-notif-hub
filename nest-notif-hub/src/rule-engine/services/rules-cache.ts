import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventLinkEntity } from '../entities/event-link.entity';

// Read on every single stream message, so it has to be free — an in-process
// Map, not a DB hit. Rules change rarely (an admin edit), so correctness
// only needs "reloaded within about a second of a change," not "always
// perfectly fresh." Single app instance, so invalidation is just a direct
// method call from the admin controllers — no Redis pub/sub needed, that
// was only ever necessary for coordinating multiple running instances.
@Injectable()
export class RulesCache implements OnModuleInit {
  private readonly logger = new Logger(RulesCache.name);
  private rulesByEventType = new Map<string, EventLinkEntity[]>();

  constructor(
    @InjectRepository(EventLinkEntity)
    private readonly eventLinkRepo: Repository<EventLinkEntity>,
  ) {}

  async onModuleInit() {
    await this.reload();
  }

  async reload() {
    const allRules = await this.eventLinkRepo.find();
    const grouped = new Map<string, EventLinkEntity[]>();
    for (const rule of allRules) {
      const list = grouped.get(rule.sourceEvent) ?? [];
      list.push(rule);
      grouped.set(rule.sourceEvent, list);
    }
    this.rulesByEventType = grouped;
    this.logger.log(`Rules cache reloaded — ${allRules.length} rule(s)`);
  }

  get(eventType: string): EventLinkEntity[] {
    return this.rulesByEventType.get(eventType) ?? [];
  }
}
