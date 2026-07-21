import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type SmsMode = 'live' | 'sandbox';

@Entity('employees')
export class EmployeeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 0 })
  xp: number;

  @Column({ default: 1 })
  level: number;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  // 'sandbox' hits Twilio's test credentials instead of sending for real —
  // see [[notification-demo-personas]]. Defaults to sandbox so seeding a
  // new employee never risks an accidental real send.
  @Column({ type: 'varchar', default: 'sandbox' })
  smsMode: SmsMode;
}
