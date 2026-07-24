import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MissionAssignmentEntity } from './mission-assignment.entity';

@Entity('missions')
export class MissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  xpGranted: number;

  @Column()
  name: string;

  // Null means this mission never expires — assignments computed from it
  // get deadline: null too. See AssignMissionHandler for where this turns
  // into an absolute per-assignment deadline.
  @Column({ type: 'int', nullable: true })
  durationDays: number | null;

  @OneToMany(() => MissionAssignmentEntity , (missionConcerned) => missionConcerned.mission)
  missionAssignments: MissionAssignmentEntity[]

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

}