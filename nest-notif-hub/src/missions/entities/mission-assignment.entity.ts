import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MissionEntity } from './mission.entity';
import { EmployeeUserEntity } from '../../users/entities/employee-user.entity';

export type AssignmentStatus = 'ASSIGNED' | 'EXPIRED' | 'COMPLETED';

@Entity('mission_assignments')
export class MissionAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  // Both a relation AND a scalar column map to the same FK column, on
  // purpose — but the two must never be mixed in the same write.
  // `.save(manager.create(...))` with relation objects ({id} partials) was
  // tried and confirmed BROKEN in this TypeORM version — it silently
  // swapped the mission/employee values between the two columns (verified
  // via MySQL's own InnoDB FK error diagnostic, not just guessed). Rule:
  // reads may use either the scalar (`assignment.missionId`) or the loaded
  // relation (`assignment.mission.xpGranted`, etc.) — writes must ALWAYS go
  // through manager.insert()/manager.update() with the flat scalar values,
  // never through the relation properties.
  @ManyToOne(() => MissionEntity)
  @JoinColumn({name : 'missionId'})
  mission : MissionEntity

  @Column()
  missionId: string;

  @ManyToOne(() => EmployeeUserEntity)
  @JoinColumn({name : 'employeeId'})
  employee: EmployeeUserEntity;

  @Column()
  employeeId: string;

  @Column({ type: 'varchar', default: 'ASSIGNED' })
  status: AssignmentStatus

  @Column()
  assignedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

}