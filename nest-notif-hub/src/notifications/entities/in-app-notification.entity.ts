import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type InAppNotificationKind = 'general' | 'reminder';

@Entity('in_app_notifications')
@Index(['employeeId', 'read'])
export class InAppNotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column('text')
  message: string;

  @Column({ default: false })
  read: boolean;

  @Column({ type: 'varchar', default: 'general' })
  kind: InAppNotificationKind;

  @Column({ unique: true })
  jobId: string;

  @Column()
  sourceEventId: string;

  @Column()
  correlationId: string;

  @Column()
  createdAt: Date;
}
