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

  @OneToMany(() => MissionAssignmentEntity , (missionConcerned) => missionConcerned.mission)
  missionAssignments: MissionAssignmentEntity[]

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

}