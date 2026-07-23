import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

// Badges are one-time achievements — the unique constraint is what makes
// GrantBadgeAction's "already has it, don't re-grant" check meaningful rather
// than just a convention. badgeId references BadgeEntity (src/badges/) — the
// catalog that owns the badge's name/threshold, not duplicated here.
@Entity('employee_badges')
@Unique(['employeeId', 'badgeId'])
export class EmployeeBadgeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  badgeId: string;

  @CreateDateColumn()
  grantedAt: Date;
}
