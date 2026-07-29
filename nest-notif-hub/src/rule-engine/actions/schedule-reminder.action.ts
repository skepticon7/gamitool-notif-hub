import { Injectable } from '@nestjs/common';
import { Action, ActionContext, ActionResult } from './action.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { ScheduledReminderEntity } from '../entities/scheduled-reminder.entity';
import { Repository } from 'typeorm';
import { computeReminderInterval } from '../services/compute-reminder-interval';

@Injectable()
export class ScheduleReminderAction implements Action {
  actionType: string = "ScheduleReminder";
  readonly requiredPayloadFields = ['employeeId', 'missionId'];
  readonly allowedSourceEvents = ['MissionAssigned']; // only makes sense at the moment a deadline-bearing mission is handed out

  constructor(
    @InjectRepository(ScheduledReminderEntity)
    private readonly reminderRepo : Repository<ScheduledReminderEntity>
  ) {}

  async execute(
    payload: Record<string, any>,
    params: Record<string, any>,
    context: ActionContext,
  ): Promise<ActionResult> {
    // No deadline means no duration to measure "time remaining" against —
    // there's nothing to escalate toward, so this mission never gets
    // reminders (same behavior as before).
    if(payload.deadline === null) {
      return {shouldEmit : false}
    }

    // The one number the admin actually configures — how often to remind
    // when there's plenty of time left. Everything past this is automatic.
    const baseIntervalHours = Number(params.baseIntervalHours ?? 24);
    const deadline = new Date(payload.deadline);
    const intervalHours = computeReminderInterval(deadline, payload.durationDays, baseIntervalHours);

    const repo : Repository<ScheduledReminderEntity> = context.manager ? context.manager.withRepository(this.reminderRepo) : this.reminderRepo;
    // durationDays/assignmentId/baseIntervalHours carried forward so
    // ReminderSweepService can recompute the next interval and check
    // whether this assignment is still active, without a second lookup.
    const reminderPayload: Record<string, any> = {
      employeeId: payload.employeeId,
      missionId: payload.missionId,
      deadline: payload.deadline,
      durationDays: payload.durationDays,
      assignmentId: payload.assignmentId,
      baseIntervalHours: baseIntervalHours,
    };
    const entity: Partial<ScheduledReminderEntity> = {
      ruleId: context.ruleId,
      employeeId: payload.employeeId,
      aggregateId: payload.missionId,
      fireAt: new Date(Date.now() + intervalHours * 60 * 60 * 1000),
      status: 'PENDING',
      payload: reminderPayload,
    };
    await repo.insert(entity);
    return {shouldEmit : false};
  }
}