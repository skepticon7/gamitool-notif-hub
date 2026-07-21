import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../entities/user.entity';
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

  create(manager: EntityManager, user: Partial<UserEntity>) {
    try {
      const entity = manager.create(UserEntity , user);
      return manager.save(entity);
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