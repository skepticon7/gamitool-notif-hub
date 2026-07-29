import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Action, ActionContext, ActionResult } from './action.interface';
import { EmployeeUserEntity } from '../../users/entities/employee-user.entity';

@Injectable()
export class GrantXPAction implements Action {
  readonly actionType = 'GrantXP';
  readonly requiredPayloadFields = ['employeeId', 'xpGranted'];
  readonly allowedSourceEvents = ['MissionCompleted']; // XP is granted for completing something, not for any event carrying an xpGranted-shaped field

  constructor(
    @InjectRepository(EmployeeUserEntity)
    private readonly employeeRepo: Repository<EmployeeUserEntity>,
  ) {}

  async execute(
    payload: Record<string, any>,
    params: Record<string, any>,
    context: ActionContext,
  ): Promise<ActionResult> {
    const amount = payload.xpGranted;
    const employeeId = payload.employeeId;

    // When called from within RuleEngineConsumer's transaction, this write
    // uses that transaction's manager — so if the surrounding transaction
    // rolls back (e.g. the outbox emit or dedupe mark fails), the XP grant
    // rolls back with it instead of leaving a real increment behind that a
    // retry would then apply a second time.
    const repo = context.manager
      ? context.manager.withRepository(this.employeeRepo)
      : this.employeeRepo;

    // Atomic UPDATE xp = xp + amount — safe under concurrent grants for the
    // same employee, unlike a read-modify-write. Level is deliberately NOT
    // touched here: CheckLevelThresholdAction recomputes it from the total,
    // never from an increment, so ordering across grants can't corrupt it.
    await repo.increment({ id: employeeId }, 'xp', amount);
    const employee = await repo.findOneByOrFail({ id: employeeId });

    return {
      shouldEmit: true,
      // Same field name as the payload this action itself reads (xpGranted)
      // — one name for "amount of XP" everywhere, so XPGranted's shape is
      // never a trap for whatever gets wired to consume it.
      payload: { employeeId, xp: employee.xp, xpGranted: amount },
    };
  }
}
