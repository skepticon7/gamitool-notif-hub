import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetMyInAppNotificationsQuery } from '../queries/get-my-in-app-notifications.query';
import { InjectRepository } from '@nestjs/typeorm';
import {
  InAppNotificationEntity,
  InAppNotificationKind,
} from '../entities/in-app-notification.entity';
import { Repository } from 'typeorm';

@QueryHandler(GetMyInAppNotificationsQuery)
export class GetMyInAppNotificationsHandler implements IQueryHandler<GetMyInAppNotificationsQuery> {

  constructor(
    @InjectRepository(InAppNotificationEntity)
    private readonly inAppNotificationRepository: Repository<InAppNotificationEntity>,
  ) {}

  async execute(query: GetMyInAppNotificationsQuery): Promise<InAppNotificationEntity[]> {
    return this.inAppNotificationRepository.find({
      where : {employeeId : query.employeeId , read : false},
      order : {createdAt : 'DESC'}
    })
  }
}