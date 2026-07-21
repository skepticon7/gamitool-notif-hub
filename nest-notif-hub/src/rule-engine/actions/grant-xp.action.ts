import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Action, ActionContext, ActionResult } from './action.interface';
import { EmployeeEntity } from '../../employees/entities/employee.entity';

@Injectable()
export class GrantXPAction implements Action {
  readonly actionType = 'GrantXP';

  constructor(
    @InjectRepository(EmployeeEntity)
    private readonly employeeRepo: Repository<EmployeeEntity>,
  ) {}

  async execute(
    payload: Record<string, any>,
    params: Record<string, any>,
    context: ActionContext,
  ): Promise<ActionResult> {
    const amount = Number(params.amount ?? 0);
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
      payload: { employeeId, xp: employee.xp, granted: amount },
    };
  }
}
