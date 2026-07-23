import { ChildEntity } from 'typeorm';
import { UserEntity } from './user.entity';

// No admin-specific columns yet — add them here when needed, same pattern
// as EmployeeUserEntity.
@ChildEntity('admin')
export class AdminUserEntity extends UserEntity {
}
