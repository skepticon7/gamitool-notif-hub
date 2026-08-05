import { CheckLevelThresholdAction } from './check-level-threshold.action';
import { ActionContext } from './action.interface';

describe('CheckLevelThresholdAction', () => {
  const baseContext: ActionContext = {
    eventId: 'evt-1',
    ruleId: 'rule-1',
    correlationId: 'corr-1',
  };

  function makeAction(employee: { id: string; xp: number; level: number }) {
    const repo = {
      findOneByOrFail: jest.fn().mockResolvedValue(employee),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const gateway = { emitToEmployee: jest.fn() };
    const action = new CheckLevelThresholdAction(repo as any, gateway as any);
    return { action, repo, gateway };
  }

  it('updates the level and emits when the computed level exceeds the stored one', async () => {
    const { action, repo, gateway } = makeAction({ id: 'emp-1', xp: 250, level: 1 });

    // baseXp=100, growthRate=1.5 -> level 2 at 100 cumulative, level 3 at 250 cumulative.
    const result = await action.execute(
      { employeeId: 'emp-1' },
      { xpPerLevel: 100, growthRate: 1.5 },
      baseContext,
    );

    expect(repo.update).toHaveBeenCalledWith({ id: 'emp-1' }, { level: 3 });
    expect(gateway.emitToEmployee).toHaveBeenCalledWith('emp-1', 'level:up', { level: 3 });
    expect(result).toEqual({
      shouldEmit: true,
      payload: { employeeId: 'emp-1', newLevel: 3, previousLevel: 1 },
    });
  });

  it('does nothing when the computed level does not exceed the stored one', async () => {
    const { action, repo, gateway } = makeAction({ id: 'emp-1', xp: 50, level: 1 });

    const result = await action.execute(
      { employeeId: 'emp-1' },
      { xpPerLevel: 100, growthRate: 1.5 },
      baseContext,
    );

    expect(repo.update).not.toHaveBeenCalled();
    expect(gateway.emitToEmployee).not.toHaveBeenCalled();
    expect(result).toEqual({ shouldEmit: false });
  });

  it('defaults xpPerLevel to 100 and growthRate to 1.5 when params are omitted', async () => {
    const { action, repo } = makeAction({ id: 'emp-1', xp: 250, level: 1 });

    const result = await action.execute({ employeeId: 'emp-1' }, {}, baseContext);

    expect(result).toEqual({
      shouldEmit: true,
      payload: { employeeId: 'emp-1', newLevel: 3, previousLevel: 1 },
    });
  });


  it('writes through context.manager.withRepository when a transaction manager is present', async () => {
    const scopedRepo = {
      findOneByOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'emp-1', xp: 250, level: 1 }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const plainRepo = { findOneByOrFail: jest.fn(), update: jest.fn() };
    const manager = { withRepository: jest.fn().mockReturnValue(scopedRepo) };

    const fakeGateway = { emitToEmployee: jest.fn() };
    const action = new CheckLevelThresholdAction(plainRepo as any, fakeGateway as any);

    await action.execute(
      { employeeId: 'emp-1' },
      { xpPerLevel: 100, growthRate: 1.5 },
      { ...baseContext, manager: manager as any },
    );

    expect(manager.withRepository).toHaveBeenCalledWith(plainRepo);
    expect(scopedRepo.update).toHaveBeenCalledWith(
      { id: 'emp-1' },
      { level: 3 },
    );
    expect(plainRepo.update).not.toHaveBeenCalled();
  });

});
