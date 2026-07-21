import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

// Tracks completion per (event, rule), not per event alone. A single event
// can fan out to several independent rules (grant XP, notify by email,
// notify by SMS) — one rule failing to complete must never block or
// re-trigger the others, so each rule's completion is recorded separately.
// A row here means "this rule's work for this event is confirmed done" —
// it must only be written AFTER the work succeeds, never before.
@Entity('processed_events')
@Unique(['consumerGroup', 'eventId', 'ruleId'])
export class ProcessedEventsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  consumerGroup: string;

  @Column()
  eventId: string;

  @Column()
  ruleId: string;
}