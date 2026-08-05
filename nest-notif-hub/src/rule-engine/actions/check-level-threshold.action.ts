import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Action, ActionContext, ActionResult } from './action.interface';
import { EmployeeUserEntity } from '../../users/entities/employee-user.entity';
import { NotificationGateway } from '../../websocket/notification.gateway';

@Injectable()
export class CheckLevelThresholdAction implements Action {
  readonly actionType = 'CheckLevelThreshold';
  readonly requiredPayloadFields = ['employeeId'];
  readonly allowedSourceEvents = ['XPGranted']; // level is derived from total XP, so this only makes sense right after XP actually changed

  constructor(
    @InjectRepository(EmployeeUserEntity)
    private readonly employeeRepo: Repository<EmployeeUserEntity>,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async execute(
    payload: Record<string, any>,
    params: Record<string, any>,
    context: ActionContext,
  ): Promise<ActionResult> {
    const employeeId = payload.employeeId;
    const baseXp = Number(params.xpPerLevel ?? 100);
    const growthRate = Number(params.growthRate ?? 1.5);
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
    const computedLevel = this.computeLevel(employee.xp, baseXp, growthRate);

    if (computedLevel <= employee.level) {
      return { shouldEmit: false };
    }

    await repo.update({ id: employeeId }, { level: computedLevel });

    this.notificationGateway.emitToEmployee(employeeId, 'level:up', {
      level: computedLevel,
    });

    return {
      shouldEmit: true,
      payload: {
        employeeId,
        newLevel: computedLevel,
        previousLevel: employee.level,
      },
    };
  }

  // Each level costs `growthRate` times more XP than the one before it —
  // e.g. baseXp=100, growthRate=1.5: level 2 needs 100 cumulative XP,
  // level 3 needs 250, level 4 needs 475, level 5 needs 813 — a growing
  // curve instead of the old flat "every N XP = 1 level." Both params stay
  // admin-tunable per wiring, same as before.
  private computeLevel(xp: number, baseXp: number, growthRate: number): number {
    let level = 1;
    let xpForNextLevel = baseXp;
    let cumulative = 0;
    while (xp >= cumulative + xpForNextLevel) {
      cumulative += xpForNextLevel;
      level++;
      xpForNextLevel = Math.round(xpForNextLevel * growthRate);
    }
    return level;
  }
}
