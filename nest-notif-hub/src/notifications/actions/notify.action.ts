import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Action,
  ActionContext,
  ActionResult,
} from '../../rule-engine/actions/action.interface';
import { EmployeeEntity } from '../../employees/entities/employee.entity';
import { NotificationChannel } from '../notifications.constants';

@Injectable()
export class NotifyAction implements Action {
  readonly actionType = 'Notify';
  private readonly logger = new Logger(NotifyAction.name);

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('sms') private readonly smsQueue: Queue,
    @InjectQueue('in-app') private readonly inAppQueue: Queue,
    @InjectRepository(EmployeeEntity)
    private readonly employeeRepo: Repository<EmployeeEntity>,
  ) {}

  async execute(
    payload: Record<string, any>,
    params: Record<string, any>,
    context: ActionContext,
  ): Promise<ActionResult> {
    const channels: NotificationChannel[] = params.channels ?? [];
    const employeeId = payload.employeeId;

    // Deliberately not using context.manager — this is a read, and the only
    // things that need to share the MySQL transaction are writes that must
    // roll back together (see GrantXPAction). A stale read here just means
    // a notification might use slightly-old contact info, which is fine.
    const employee = await this.employeeRepo.findOneByOrFail({
      id: employeeId,
    });

    for (const channel of channels) {
      const queue = this.resolveQueue(channel);
      const recipient = this.resolveRecipient(employee, channel);

      if (!queue) {
        this.logger.warn(`Unknown channel "${channel}" — no queue registered, skipping`);
        continue;
      }
      if (!recipient) {
        this.logger.warn(
          `Skipping ${channel} for employee ${employeeId}: no recipient configured (event ${context.eventId})`,
        );
        continue;
      }

      await queue.add(
        'deliver',
        {
          channel,
          employeeId,
          recipient,
          message: params.message ?? `Notification for ${employee.name}`,
          correlationId: context.correlationId,
          sourceEventId: context.eventId,
        },
        {
          // Deterministic, not random — a retry of this rule (which the
          // MySQL transaction can't protect, since Redis isn't part of it)
          // re-enqueues the SAME job instead of creating a duplicate send.
          jobId: `${context.eventId}:${context.ruleId}:${channel}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    }

    // Leaf action — nothing chains after a notification.
    return { shouldEmit: false };
  }

  private resolveQueue(channel: NotificationChannel): Queue | undefined {
    switch (channel) {
      case 'email':
        return this.emailQueue;
      case 'sms':
        return this.smsQueue;
      case 'in-app':
        return this.inAppQueue;
      default:
        return undefined;
    }
  }

  private resolveRecipient(
    employee: EmployeeEntity,
    channel: NotificationChannel,
  ): string | null {
    switch (channel) {
      case 'email':
        return employee.email;
      case 'sms':
        return employee.phone;
      case 'in-app':
        return employee.id;
      default:
        return null;
    }
  }
}
