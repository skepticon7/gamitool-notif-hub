import { ChildEntity, Column, OneToMany } from 'typeorm';
import { UserEntity } from './user.entity';
import { MissionAssignmentEntity } from '../../missions/entities/mission-assignment.entity';

export type SmsMode = 'live' | 'sandbox';

@ChildEntity('employee')
export class EmployeeUserEntity extends UserEntity {
  // No DB-level defaults — these columns only mean something for employee
  // rows. CreateUserHandler sets xp/level/smsMode explicitly when creating
  // an employee; a DB default would otherwise silently populate them on
  // admin rows too, since STI is one shared physical table.
  @Column({ type: 'int', nullable: true })
  xp: number;

  @Column({ type: 'int', nullable: true })
  level: number;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  smsMode: SmsMode;

  @OneToMany(() => MissionAssignmentEntity, (assignment) => assignment.employee)
  missionsAssigned: MissionAssignmentEntity[];
}
