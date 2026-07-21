import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('event_links')
@Index(['sourceEvent'])
export class EventLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // What RuleEngineConsumer looks up by — RulesCache is keyed on this field.
  @Column()
  sourceEvent: string;

  // Name of a registered Action (GrantXP, Notify, CheckLevelThreshold, ...).
  // Resolved against ActionRegistry at dispatch time — this table has no FK
  // to the action catalog since that catalog lives in code, not the DB.
  @Column()
  action: string;

  // Arguments passed to Action.execute(payload, params) — shape depends on
  // which action this row names, so it stays untyped at the DB layer.
  @Column('json')
  params: Record<string, any>;

  // If set, a truthy ActionResult.shouldEmit causes the consumer to write a
  // new outbox row of this event type, with causationId = the triggering
  // event's eventId. Null means this rule's action has no downstream event
  // (e.g. Notify — it enqueues a job and stops).
  @Column({ type: 'varchar', nullable: true })
  targetEvent: string | null;
}
