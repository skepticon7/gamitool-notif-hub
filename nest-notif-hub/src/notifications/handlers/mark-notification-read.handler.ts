import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { MarkNotificationReadCommand } from '../commands/mark-notification-read.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InAppNotificationEntity } from '../entities/in-app-notification.entity';
import { BusinessException } from '../../shared/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';

@CommandHandler(MarkNotificationReadCommand)
export class MarkNotificationReadHandler implements ICommandHandler<MarkNotificationReadCommand> {
  constructor(
    @InjectRepository(InAppNotificationEntity)
    private readonly inAppNotificationRepository: Repository<InAppNotificationEntity>,
  ) {}

  async execute(command: MarkNotificationReadCommand): Promise<any> {
    const result = await this.inAppNotificationRepository.update(
      { id: command.notificationId, employeeId: command.employeeId }, // ownership check lives in this WHERE
      { read: true },
    );
    if (result.affected == 0) {
      throw new BusinessException(
        'NOTIFICATION_NOT_FOUND',
        'Notification not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return { updated: true };
  }
}