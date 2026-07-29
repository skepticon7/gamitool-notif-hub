import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarkAllNotificationsReadCommand } from '../commands/mark-all-notifications-read.command';
import { InAppNotificationEntity } from '../entities/in-app-notification.entity';

@CommandHandler(MarkAllNotificationsReadCommand)
export class MarkAllNotificationsReadHandler
  implements ICommandHandler<MarkAllNotificationsReadCommand>
{
  constructor(
    @InjectRepository(InAppNotificationEntity)
    private readonly inAppNotificationRepository: Repository<InAppNotificationEntity>,
  ) {}

  async execute(command: MarkAllNotificationsReadCommand) {
    await this.inAppNotificationRepository.update(
      { employeeId: command.employeeId, read: false },
      { read: true },
    );
    return { updated: true };
  }
}
