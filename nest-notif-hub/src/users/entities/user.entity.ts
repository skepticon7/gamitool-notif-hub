import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'admin' | 'employee';

// Single Table Inheritance: admins and employees are the same physical row
// in the same `users` table, discriminated by the `role` column. This means
// an employee's `id` IS their user id — no separate linking column/query
// needed to go from a JWT's userId to "their" employee record. See
// EmployeeUserEntity / AdminUserEntity for the role-specific columns.
@Entity('users')
@TableInheritance({ column: { type: 'varchar', name: 'role' } })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({unique: true})
  sub: string;

  @Column({unique: true})
  email: string;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

}
