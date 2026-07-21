import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ScheduledReminderStatus = 'PENDING' | 'CANCELLED' | 'SENT';

// A durable fact, not a BullMQ delayed job — this is what lets a reminder
// survive a Redis flush. A sweep (ReminderSweepService) periodically checks
// this table and materializes due, uncancelled rows into a real 'ReminderDue'
// outbox event, which then flows through the normal rule engine pipeline.
@Entity('scheduled_reminders')
@Index(['status', 'fireAt'])
export class ScheduledReminderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Which event_links row scheduled this — for traceability, not enforced
  // as a real foreign key (rules can be edited/deleted independently).
  @Column()
  ruleId: string;

  @Column()
  employeeId: string;

  // The business key a later event is matched against to cancel this
  // reminder — e.g. a missionId. NOT a correlationId: the event that
  // schedules a reminder and the event that should cancel it are two
  // separate root actions, so they never share one.
  @Column()
  aggregateId: string;

  @Column()
  fireAt: Date;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: ScheduledReminderStatus;

  // Carried into the 'ReminderDue' event's payload once this fires.
  @Column('json')
  payload: Record<string, any>;
}
