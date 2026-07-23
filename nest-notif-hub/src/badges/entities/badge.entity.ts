import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// The badge catalog — same role as MissionEntity for missions. GrantBadgeAction
// looks a badge up by id (via params.badgeId in its event_link wiring) instead
// of having its name/threshold retyped into every wiring that grants it.
@Entity('badges')
export class BadgeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column()
  threshold: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
