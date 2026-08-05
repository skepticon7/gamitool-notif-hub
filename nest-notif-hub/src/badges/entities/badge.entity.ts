import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond';

// The badge catalog — same role as MissionEntity for missions. GrantBadgeAction
// scans this whole catalog against an employee's completed-mission count
// (no badgeId param) — see GrantBadgeAction for why.
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

  // Purely a display/grouping concept (matches the GamiPanel design
  // system's bronze/silver/gold/diamond tier colors) — GrantBadgeAction
  // never reads this, it only compares `threshold` against the completed
  // count.
  @Column({ type: 'varchar' })
  tier: BadgeTier;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
