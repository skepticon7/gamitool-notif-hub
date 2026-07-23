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
import { EmployeeUserEntity } from '../../users/entities/employee-user.entity';
import { NotificationChannel } from '../notifications.constants';

@Injectable()
export class NotifyAction implements Action {
  readonly actionType = 'Notify';
  readonly requiredPayloadFields = ['employeeId'];
  private readonly logger = new Logger(NotifyAction.name);

  constructor(
    // 'in-app' is the only channel EDEN delivers itself. Every other
    // channel name the admin picks in params.channels (email, sms, discord,
    // slack, ...) shares this ONE queue — see N8nProcessor for why one
    // shared queue works for an open-ended set of channels: the job payload
    // just carries which channel it's for, and n8n has a separate workflow
    // per channel to act on it.
    @InjectQueue('n8n') private readonly n8nQueue: Queue,
    @InjectQueue('in-app') private readonly inAppQueue: Queue,
    @InjectRepository(EmployeeUserEntity)
    private readonly employeeRepo: Repository<EmployeeUserEntity>,
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
    const message = params.message ?? `Notification for ${employee.name}`;

    for (const channel of channels) {
      if (!this.hasDeliverableContact(employee, channel)) {
        this.logger.warn(
          `Skipping ${channel} for employee ${employeeId}: no contact info for this channel (event ${context.eventId})`,
        );
        continue;
      }

      const jobId = `${context.eventId}:${context.ruleId}:${channel}`;
      const jobOptions = {
        // Deterministic, not random — a retry of this rule (which the
        // MySQL transaction can't protect, since Redis isn't part of it)
        // re-enqueues the SAME job instead of creating a duplicate send.
        jobId,
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 2000 },
      };

      if (channel === 'in-app') {
        await this.inAppQueue.add(
          'deliver',
          {
            channel,
            employeeId,
            recipient: employee.id,
            message,
            correlationId: context.correlationId,
            sourceEventId: context.eventId,
          },
          jobOptions,
        );
        continue;
      }

      // Every other channel: one shared job shape, richer than a single
      // "recipient" string, since which field n8n's workflow actually needs
      // (email vs phone vs nothing at all, for e.g. a Discord channel post)
      // depends on the channel, not on anything EDEN needs to know about.
      await this.n8nQueue.add(
        'deliver',
        {
          channel,
          employeeId,
          email: employee.email,
          phone: employee.phone,
          name: employee.name,
          message,
          correlationId: context.correlationId,
          sourceEventId: context.eventId,
        },
        jobOptions,
      );
    }

    // Leaf action — nothing chains after a notification.
    return { shouldEmit: false };
  }

  // Only email/sms have a per-employee contact field that can genuinely be
  // missing. Other channels (discord, slack, ...) have nothing on
  // EmployeeUserEntity to check — e.g. a Discord post might go to a fixed
  // channel rather than a per-employee DM — so there's nothing to gate on.
  private hasDeliverableContact(employee: EmployeeUserEntity, channel: NotificationChannel): boolean {
    if (channel === 'email') return !!employee.email;
    if (channel === 'sms') return !!employee.phone;
    return true;
  }
}
