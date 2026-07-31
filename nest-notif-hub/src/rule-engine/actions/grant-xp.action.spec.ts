import { GrantXPAction } from './grant-xp.action';
import { ActionContext } from './action.interface';

describe('GrantXPAction', () => {
  const baseContext: ActionContext = {
    eventId: 'evt-1',
    ruleId: 'rule-1',
    correlationId: 'corr-1',
  };

  it('increments xp via the repo, reads it back, and emits the running total', async () => {
    const mockRepo = {
      increment: jest.fn().mockResolvedValue(undefined),
      findOneByOrFail: jest.fn().mockResolvedValue({ id: 'emp-1', xp: 150 }),
    };
    const action = new GrantXPAction(mockRepo as any);

    const result = await action.execute(
      { employeeId: 'emp-1', xpGranted: 50 },
      {},
      baseContext,
    );

    expect(mockRepo.increment).toHaveBeenCalledWith({ id: 'emp-1' }, 'xp', 50);
    expect(result).toEqual({
      shouldEmit: true,
      payload: { employeeId: 'emp-1', xp: 150, xpGranted: 50 },
    });
  });

  it('writes through context.manager.withRepository when a transaction manager is present', async () => {
    const scopedRepo = {
      increment: jest.fn().mockResolvedValue(undefined),
      findOneByOrFail: jest.fn().mockResolvedValue({ id: 'emp-1', xp: 200 }),
    };
    const plainRepo = {
      increment: jest.fn(),
      findOneByOrFail: jest.fn(),
    };
    const manager = {
      withRepository: jest.fn().mockReturnValue(scopedRepo),
    };
    const action = new GrantXPAction(plainRepo as any);

    await action.execute(
      { employeeId: 'emp-1', xpGranted: 25 },
      {},
      { ...baseContext, manager: manager as any },
    );

    expect(manager.withRepository).toHaveBeenCalledWith(plainRepo);
    expect(scopedRepo.increment).toHaveBeenCalledWith({ id: 'emp-1' }, 'xp', 25);
    // The un-scoped repo must never be touched once a transaction manager is given.
    expect(plainRepo.increment).not.toHaveBeenCalled();
  });
});
