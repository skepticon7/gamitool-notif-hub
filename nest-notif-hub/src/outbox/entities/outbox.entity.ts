import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type OutboxStatus = 'PENDING' | 'PROCESSED' | 'DEAD';

@Entity('outbox_events')
@Index(['status', 'occurredOn'])
export class OutboxEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventType: string;

  @Column({ unique: true })
  eventId: string;

  @Column({ default: 1 })
  version: number;

  @Column()
  correlationId: string;

  @Column({ type: 'varchar', nullable: true })
  causationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  aggregateType: string | null;

  @Column({ type: 'varchar', nullable: true })
  aggregateId: string | null;

  @Column('json')
  payload: Record<string, any>;

  @Column({ default: 'PENDING' })
  status: OutboxStatus;

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column()
  occurredOn: Date;

  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date | null;
}
