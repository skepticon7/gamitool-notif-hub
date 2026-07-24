import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetMyBadgesQuery } from '../queries/get-my-badges.query';
import { InjectRepository } from '@nestjs/typeorm';
import { BadgeEntity } from '../entities/badge.entity';
import { In, Repository } from 'typeorm';
import { EmployeeUserEntity } from '../../users/entities/employee-user.entity';
import { EmployeeBadgeEntity } from '../../users/entities/employee-badge.entity';

@QueryHandler(GetMyBadgesQuery)
export class GetMyBadgesHandler implements IQueryHandler<GetMyBadgesQuery> {
  constructor(
    @InjectRepository(EmployeeBadgeEntity)
    private readonly employeeBadgeRepository: Repository<EmployeeBadgeEntity>,
    @InjectRepository(EmployeeUserEntity)
    private readonly employeeUserRepository: Repository<EmployeeUserEntity>,
    @InjectRepository(BadgeEntity)
    private readonly badgeRepository: Repository<BadgeEntity>
  ) {}

  async execute(query: GetMyBadgesQuery): Promise<any> {

    const badgeIdsRows = await this.employeeBadgeRepository.find({
      where : {employeeId : query.employeeId},
      select : {
        badgeId: true
      }
    })


    const badgeIds = badgeIdsRows.map((b) => b.badgeId)

    return await this.badgeRepository.find({
      where : {
        id: In(badgeIds)
      }
    });
  }
}