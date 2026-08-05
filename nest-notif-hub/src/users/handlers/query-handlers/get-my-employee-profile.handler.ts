import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetMyEmployeeProfileQuery } from '../../queries/get-my-employee-profile.query';
import { EmployeeUserEntity } from '../../entities/employee-user.entity';
import { BusinessException } from '../../../shared/exceptions/business.exception';
import { MissionAssignmentEntity } from '../../../missions/entities/mission-assignment.entity';
import { EmployeeBadgeEntity } from '../../entities/employee-badge.entity';
import { EmployeeInfoDto } from '../../dto/employee-info.dto';
import { BadgeEntity } from '../../../badges/entities/badge.entity';

@QueryHandler(GetMyEmployeeProfileQuery)
export class GetMyEmployeeProfileHandler implements IQueryHandler<GetMyEmployeeProfileQuery> {
  constructor(
    @InjectRepository(EmployeeUserEntity)
    private readonly employeeUserRepository: Repository<EmployeeUserEntity>,
    @InjectRepository(MissionAssignmentEntity)
    private readonly missionAssignmentRepository: Repository<MissionAssignmentEntity>,
    @InjectRepository(EmployeeBadgeEntity)
    private readonly employeeBadgeRepository: Repository<EmployeeBadgeEntity>,
    @InjectRepository(BadgeEntity)
    private readonly badgeEntity : Repository<BadgeEntity>
  ) {}

  async execute(query: GetMyEmployeeProfileQuery): Promise<EmployeeInfoDto> {
    const employee = await this.employeeUserRepository.findOneBy({ id: query.employeeId });
    if (!employee) {
      // Shouldn't happen for a JWT that already passed JwtAuthGuard — this
      // is the same "identity got deprovisioned after the token was
      // issued" edge case AuthService.resolveUser/refresh guard against,
      // so it reuses their errorCode rather than inventing a new one.
      throw new BusinessException(
        'ACCOUNT_NOT_PROVISIONED',
        'No account exists for this identity — ask an admin to create one',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const missionsCompleted = await this.missionAssignmentRepository.count({where : {employeeId : query.employeeId , status : 'COMPLETED'}});
    const badgesEarned = await this.employeeBadgeRepository.count({where : {employeeId : query.employeeId}});
    const totalBadges = await this.badgeEntity.count();
    return {
      xp : employee.xp,
      level: employee.level,
      missionsCompleted : missionsCompleted ?? 0,
      badgesEarned : badgesEarned ?? 0,
      totalBadges
    }
  }
}
