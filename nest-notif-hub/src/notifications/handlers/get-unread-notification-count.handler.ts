import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUnreadNotificationCountQuery } from '../queries/get-unread-notification-count.query';
import { InjectRepository } from '@nestjs/typeorm';
import { InAppNotificationEntity } from '../entities/in-app-notification.entity';
import { Repository } from 'typeorm';

@QueryHandler(GetUnreadNotificationCountQuery)
export class GetUnreadNotificationCountQueryHandler implements IQueryHandler<GetUnreadNotificationCountQuery> {

  constructor(
    @InjectRepository(InAppNotificationEntity)
    private readonly inAppNotificationRepository : Repository<InAppNotificationEntity>
  ) {
  }

  async execute(query: GetUnreadNotificationCountQuery): Promise<any> {
    return await this.inAppNotificationRepository.count({where : {employeeId : query.employeeId , read : false}})
  }
}