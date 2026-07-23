import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity, UserRole } from '../entities/user.entity';
import { EmployeeUserEntity } from '../entities/employee-user.entity';
import { AdminUserEntity } from '../entities/admin-user.entity';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { BusinessException } from '../../shared/exceptions/business.exception';

@Injectable()
export class MySqlUserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  findBySub(sub: string) {
    return this.repository.findOne({ where: { sub } });
  }

  // STI requires creating via the specific child class (EmployeeUserEntity /
  // AdminUserEntity) for TypeORM to set the `role` discriminator column
  // correctly — creating a plain UserEntity wouldn't populate it.
  async create(manager: EntityManager, role: UserRole, user: Record<string, any>) {
    try {
      const EntityClass = role === 'employee' ? EmployeeUserEntity : AdminUserEntity;
      const entity = manager.create(EntityClass, user);
      return await manager.save(entity);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).driverError?.code === 'ER_DUP_ENTRY'
      ) {
        throw new BusinessException(
          'MYSQL_DUPLICATE_ENTRY',
          "User already exist",
          HttpStatus.CONFLICT,
        );
      }
      throw new BusinessException(
        'MYSQL_ERROR',
        error instanceof Error ? error.message : "Unknown Mysql error",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
