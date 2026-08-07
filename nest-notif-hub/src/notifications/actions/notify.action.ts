import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  Action,
  ActionContext,
  ActionResult,
} from '../../rule-engine/actions/action.interface';
import { EmployeeUserEntity } from '../../users/entities/employee-user.entity';
import { InAppNotificationEntity, InAppNotificationKind } from '../entities/in-app-notification.entity';
import { NotificationChannel } from '../notifications.constants';
import { interpolateTemplate } from '../services/interpolate-template';
import { NotificationGateway } from '../../websocket/notification.gateway';
import { OutboxRepository } from '../../outbox/repositories/outbox.repository';

const DEFAULT_MESSAGE_TEMPLATE = 'Notification for {{name}}';

@Injectable()
export class NotifyAction implements Action {
  readonly actionType = 'Notify';
  readonly requiredPayloadFields = ['employeeId'];
  readonly allowedSourceEvents = ['*']; // genuinely generic — "tell someone something happened" applies to almost any event
  private readonly logger = new Logger(NotifyAction.name);

  constructor(
    // Every channel name the admin picks in params.channels other than
    // in-app (email, sms, discord, slack, ...) shares this ONE queue — see
    // N8nProcessor for why one shared queue works for an open-ended set of
    // channels: the job payload just carries which channel it's for, and
    // n8n has a separate workflow per channel to act on it. Those channels
    // genuinely need BullMQ's retry/backoff — they call an unreliable
    // external system (n8n). in-app doesn't: it's delivered directly below,
    // same pattern as GrantXPAction/GrantBadgeAction, since it's just a
    // local MySQL write + socket emit with nothing external to retry.
    @InjectQueue('n8n') private readonly n8nQueue: Queue,
    @InjectRepository(EmployeeUserEntity)
    private readonly employeeRepo: Repository<EmployeeUserEntity>,
    @InjectRepository(InAppNotificationEntity)
    private readonly inAppNotificationRepo: Repository<InAppNotificationEntity>,
    private readonly notificationGateway: NotificationGateway,
    private readonly outboxRepository: OutboxRepository,
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
    // params.message is an admin-authored template (e.g. "Reminder:
    // {{missionName}} expires in {{daysLeft}} day(s)") — every event type
    // goes through the same interpolation, not just reminders. Which
    // {{fields}} are actually valid for a given wiring is enforced at
    // wiring time by EventLinkGraphValidator, not here.
    const template = params.message ?? DEFAULT_MESSAGE_TEMPLATE;
    const message = interpolateTemplate(template, { ...payload, name: employee.name });

    for (const channel of channels) {
      if (!this.hasDeliverableContact(employee, channel)) {
        this.logger.warn(
          `Skipping ${channel} for employee ${employeeId}: no contact info for this channel (event ${context.eventId})`,
        );
        continue;
      }

      if (channel === 'in-app') {
        await this.deliverInApp(employeeId, message, params.kind ?? 'general', context);
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
        {
          // Deterministic, not random — a retry of this rule (which the
          // MySQL transaction can't protect, since Redis isn't part of it)
          // re-enqueues the SAME job instead of creating a duplicate send.
          jobId: `${context.eventId}:${context.ruleId}:${channel}`,
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 2000 },
        },
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

  // Delivers the in-app channel directly instead of enqueuing to BullMQ —
  // it's just a local MySQL write + socket emit, nothing external to retry,
  // so routing it through a queue only ever added latency (a visible gap
  // between this and other same-event socket emits like mission:assigned,
  // which fire synchronously) for zero reliability benefit. Same pattern as
  // GrantXPAction/GrantBadgeAction: do the write with context.manager so it
  // commits atomically with the rest of this rule's transaction.
  private async deliverInApp(
    employeeId: string,
    message: string,
    kind: InAppNotificationKind,
    context: ActionContext,
  ): Promise<void> {
    const jobId = `${context.eventId}:${context.ruleId}:in-app`;
    const repo = context.manager
      ? context.manager.withRepository(this.inAppNotificationRepo)
      : this.inAppNotificationRepo;

    const notification = {
      id: randomUUID(),
      employeeId,
      correlationId: context.correlationId,
      sourceEventId: context.eventId,
      eventType: context.eventType,
      kind,
      message,
      jobId,
      createdAt: new Date(),
    };


    console.log("sending notification : " + JSON.stringify(notification));

    try {
      await repo.insert(notification);
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') {
        // Already delivered on a prior pass (replay) — same row, same
        // jobId, nothing left to do.
        this.logger.warn(`In-app notification ${jobId} already recorded, skipping`);
        return;
      }
      // Anything else propagates, same as every other action in this
      // codebase (GrantXPAction, GrantBadgeAction, ...) — no independent
      // retry here anymore; the transaction rolls back (including the
      // processed_events dedupe mark) and the outer replay-on-error safety
      // net is what recovers it.
      throw e;
    }

    const unreadCount = await repo.count({
      where : {
        employeeId,
        read : false
      }
    });


    this.notificationGateway.emitToEmployee(employeeId, 'notification:new', {
      notification : {
        id: notification.id,
        message: notification.message,
        kind: notification.kind,
        eventType: notification.eventType,
        read: false,
        createdAt: notification.createdAt,
      },
      unreadCount,
    });

    // Tracking write, same manager as the rest of this rule's transaction
    // so it commits atomically — mirrors NotificationDelivered for every
    // other channel. Isolated in its own try/catch: the notification
    // itself already landed by this point, so a failure recording the
    // audit trail must never undo or fail the delivery that already
    // happened.
    if (context.manager) {
      try {
        await this.outboxRepository.create(context.manager, {
          eventType: 'NotificationDelivered',
          eventId: randomUUID(),
          correlationId: context.correlationId,
          causationId: context.eventId,
          aggregateType: 'Notification',
          aggregateId: employeeId,
          occurredOn: new Date(),
          payload: {
            employeeId,
            channel: 'in-app',
            correlationId: context.correlationId,
            sourceEventId: context.eventId,
          },
        });
      } catch (trackingError) {
        this.logger.warn(
          `Failed to record NotificationDelivered for ${context.correlationId}: ${trackingError instanceof Error ? trackingError.message : trackingError}`,
        );
      }
    }
  }
}
