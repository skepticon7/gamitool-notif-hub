import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Action, ActionContext, ActionResult } from './action.interface';
import { ScheduledReminderEntity } from '../entities/scheduled-reminder.entity';

@Injectable()
export class CancelReminderAction implements Action {
  readonly actionType = 'CancelReminder';
  readonly requiredPayloadFields = ['employeeId', 'missionId'];
  // Both completion AND expiry should stop a pending reminder — a reminder
  // firing for a mission that's already expired would say "expires in N
  // days" about something that's already past due.
  readonly allowedSourceEvents = ['MissionCompleted', 'MissionExpired'];

  constructor(
    @InjectRepository(ScheduledReminderEntity)
    private readonly reminderRepo: Repository<ScheduledReminderEntity>,
  ) {}

  async execute(
    payload: Record<string, any>,
    params: Record<string, any>,
    context: ActionContext,
  ): Promise<ActionResult> {
    const repo = context.manager
      ? context.manager.withRepository(this.reminderRepo)
      : this.reminderRepo;

    // Matches on employeeId + the business key (aggregateId, e.g. missionId)
    // — NOT on correlationId or eventId, since the event that scheduled the
    // reminder and this cancelling event are two separate root actions and
    // never share a tracing ID. Only PENDING rows are touched, so this is
    // safe to run even if the reminder already fired or was cancelled.
    await repo.update(
      {
        employeeId: payload.employeeId,
        aggregateId: payload.missionId,
        status: 'PENDING',
      },
      { status: 'CANCELLED' },
    );

    // Leaf action — cancellation has no downstream event of its own.
    return { shouldEmit: false };
  }
}
