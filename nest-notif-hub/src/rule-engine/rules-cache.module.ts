import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventLinkEntity } from './entities/event-link.entity';
import { RulesCache } from './services/rules-cache';

// Split out from RuleEngineModule so other domains that only need to check
// "is a rule wired for event X" (e.g. ActivityFeedConsumer's xpStatus field)
// can depend on this alone — the in-memory cache itself — instead of
// pulling in the whole rule-engine module tree (every action, CQRS
// handler, sweep service) just for one lookup. RuleEngineModule imports
// this too and re-exports RulesCache, so nothing there changes behavior.
@Module({
  imports: [TypeOrmModule.forFeature([EventLinkEntity])],
  providers: [RulesCache],
  exports: [RulesCache],
})
export class RulesCacheModule {}
