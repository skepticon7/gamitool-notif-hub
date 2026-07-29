import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MissionEntity } from './mission.entity';

export type RecurrenceInterval = 'daily' | 'weekly' | 'monthly';
export type SchedulmentScope = 'all' | 'specific';
export type SchedulmentStatus = 'ACTIVE' | 'CANCELLED';

// A schedulment is deliberately decoupled from MissionEntity — "assign
// mission X, recurring weekly, to these employees" is an admin action, not
// a property of the mission catalog item itself. A mission stays a reusable
// template; any number of independent schedulments can point at it.
@Entity('mission_schedulments')
export class MissionSchedulmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Same dual relation+scalar shape as MissionAssignmentEntity, same rule
  // applies: writes go through manager.insert()/update() with flat scalar
  // values, never save(create()) with relation objects — confirmed broken
  // in this TypeORM version (see mission-assignment.entity.ts).
  @ManyToOne(() => MissionEntity)
  @JoinColumn({ name: 'missionId' })
  mission: MissionEntity;

  @Column()
  missionId: string;

  @Column({ type: 'varchar' })
  recurrenceInterval: RecurrenceInterval;

  @Column({ type: 'varchar' })
  scope: SchedulmentScope;

  // Only meaningful when scope === 'specific'. JSON column rather than a
  // join table — nothing needs to query "which schedulments target employee
  // X" from the employee side, so there's no relational-integrity reason to
  // justify a new table (same reasoning as OutboxEntity.payload).
  @Column({ type: 'json', nullable: true })
  employeeIds: string[] | null;

  @Column({ type: 'datetime' })
  nextRecurrenceAt: Date;

  // CANCELLED, not deleted — keeps a history of schedules that existed,
  // same reasoning as MissionAssignmentEntity's status enum over row
  // deletion. The sweep only ever claims ACTIVE rows.
  @Column({ type: 'varchar', default: 'ACTIVE' })
  status: SchedulmentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
