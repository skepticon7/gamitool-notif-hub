import { Injectable } from '@nestjs/common';
import { Action, ActionContext, ActionResult } from './action.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { ScheduledReminderEntity } from '../entities/scheduled-reminder.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ScheduleReminderAction implements Action {
  actionType: string = "ScheduleReminder";
  readonly requiredPayloadFields = ['employeeId', 'missionId'];

  constructor(
    @InjectRepository(ScheduledReminderEntity)
    private readonly reminderRepo : Repository<ScheduledReminderEntity>
  ) {}

  async execute(
    payload: Record<string, any>,
    params: Record<string, any>,
    context: ActionContext,
  ): Promise<ActionResult> {
    if(payload.deadline === null) {
      return {shouldEmit : false}
    }
    const delayMs = Number(params.delaySeconds ?? 120) * 1000;
    const repo : Repository<ScheduledReminderEntity> = context.manager ? context.manager.withRepository(this.reminderRepo) : this.reminderRepo;
    await repo.insert({
      ruleId: context.ruleId,
      employeeId: payload.employeeId,
      aggregateId: payload.missionId,
      fireAt: new Date(Date.now() + delayMs),
      status: 'PENDING',
      payload: { employeeId: payload.employeeId, missionId: payload.missionId },
    });
    return {shouldEmit : false};
  }
}