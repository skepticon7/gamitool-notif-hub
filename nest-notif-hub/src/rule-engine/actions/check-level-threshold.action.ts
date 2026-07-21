import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Action, ActionContext, ActionResult } from './action.interface';
import { EmployeeEntity } from '../../employees/entities/employee.entity';

@Injectable()
export class CheckLevelThresholdAction implements Action {
  readonly actionType = 'CheckLevelThreshold';

  constructor(
    @InjectRepository(EmployeeEntity)
    private readonly employeeRepo: Repository<EmployeeEntity>,
  ) {}

  async execute(
    payload: Record<string, any>,
    params: Record<string, any>,
    context: ActionContext,
  ): Promise<ActionResult> {
    const employeeId = payload.employeeId;
    const xpPerLevel = Number(params.xpPerLevel ?? 100);
    const repo = context.manager
      ? context.manager.withRepository(this.employeeRepo)
      : this.employeeRepo;

    // Read the current total from the database rather than trusting
    // payload.xp — level is derived from the source of truth, not from a
    // potentially-stale event snapshot. This is what keeps level correct
    // regardless of the order concurrent XPGranted events are processed in.
    const employee = await repo.findOneByOrFail({
      id: employeeId,
    });
    const computedLevel = Math.floor(employee.xp / xpPerLevel) + 1;

    if (computedLevel <= employee.level) {
      return { shouldEmit: false };
    }

    await repo.update({ id: employeeId }, { level: computedLevel });

    return {
      shouldEmit: true,
      payload: {
        employeeId,
        newLevel: computedLevel,
        previousLevel: employee.level,
      },
    };
  }
}
