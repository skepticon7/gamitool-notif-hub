import { GrantBadgeAction } from './grant-badge.action';
import { ActionContext } from './action.interface';

describe('GrantBadgeAction', () => {
  const baseContext: ActionContext = {
    eventId: 'evt-1',
    ruleId: 'rule-1',
    correlationId: 'corr-1',
  };

  function makeAction(opts: {
    alreadyGranted?: { badgeId: string }[];
    eligibleBadges?: { id: string; name: string }[];
  }) {
    const badgeGrantRepo = {
      find: jest.fn().mockResolvedValue(opts.alreadyGranted ?? []),
      insert: jest.fn().mockResolvedValue(undefined),
    };
    const assignmentRepo = {
      count: jest.fn().mockResolvedValue(3), // completed-mission count, value itself doesn't matter here
    };
    const badgeCatalogRepo = {
      find: jest.fn().mockResolvedValue(opts.eligibleBadges ?? []),
    };
    const notificationGateway = { emitToEmployee: jest.fn() };
    const action = new GrantBadgeAction(
      badgeGrantRepo as any,
      assignmentRepo as any,
      badgeCatalogRepo as any,
      notificationGateway as any,
    );
    return { action, badgeGrantRepo, assignmentRepo, badgeCatalogRepo, notificationGateway };
  }

  it('emits nothing when no badge threshold is met', async () => {
    const { action, badgeGrantRepo, notificationGateway } = makeAction({ eligibleBadges: [] });

    const result = await action.execute({ employeeId: 'emp-1' }, {}, baseContext);

    expect(result).toEqual({ shouldEmit: false });
    expect(badgeGrantRepo.insert).not.toHaveBeenCalled();
    expect(notificationGateway.emitToEmployee).not.toHaveBeenCalled();
  });

  it('grants a newly-eligible badge that was not already granted', async () => {
    const { action, badgeGrantRepo, notificationGateway } = makeAction({
      alreadyGranted: [],
      eligibleBadges: [{ id: 'badge-1', name: 'Bronze Achiever' }],
    });

    const result = await action.execute({ employeeId: 'emp-1' }, {}, baseContext);

    expect(badgeGrantRepo.insert).toHaveBeenCalledTimes(1);
    expect(badgeGrantRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: 'emp-1', badgeId: 'badge-1' }),
    );
    expect(notificationGateway.emitToEmployee).toHaveBeenCalledWith('emp-1', 'badge:granted', {
      badge: { id: 'badge-1', name: 'Bronze Achiever' },
    });
    expect(result).toEqual({
      shouldEmit: true,
      payload: { employeeId: 'emp-1', badges: [{ id: 'badge-1', name: 'Bronze Achiever' }] },
    });
  });

  it('excludes a badge that is threshold-eligible but already granted', async () => {
    const { action, badgeGrantRepo, notificationGateway } = makeAction({
      alreadyGranted: [{ badgeId: 'badge-1' }],
      eligibleBadges: [{ id: 'badge-1', name: 'Bronze Achiever' }],
    });

    const result = await action.execute({ employeeId: 'emp-1' }, {}, baseContext);

    expect(badgeGrantRepo.insert).not.toHaveBeenCalled();
    expect(notificationGateway.emitToEmployee).not.toHaveBeenCalled();
    expect(result).toEqual({ shouldEmit: false });
  });


  it('writes through context.manager.withRepository for all three repos when present', async () => {
    const scopedBadgeGrantRepo = {
      find: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockResolvedValue(undefined),
    };
    const scopedAssignmentRepo = { count: jest.fn().mockResolvedValue(3) };
    const scopedBadgeCatalogRepo = {
      find: jest
        .fn()
        .mockResolvedValue([{ id: 'badge-1', name: 'Bronze Achiever' }]),
    };

    const plainBadgeGrantRepo = { find: jest.fn(), insert: jest.fn() };
    const plainAssignmentRepo = { count: jest.fn() };
    const plainBadgeCatalogRepo = { find: jest.fn() };

    const manager = {
      withRepository: jest.fn().mockImplementation((repo) => {
        if (repo === plainBadgeGrantRepo) return scopedBadgeGrantRepo;
        if (repo === plainAssignmentRepo) return scopedAssignmentRepo;
        if (repo === plainBadgeCatalogRepo) return scopedBadgeCatalogRepo;
      }),
    };

    const fakeGateway = { emitToEmployee: jest.fn() };
    const action = new GrantBadgeAction(
      plainBadgeGrantRepo as any,
      plainAssignmentRepo as any,
      plainBadgeCatalogRepo as any,
      fakeGateway as any,
    );

    await action.execute(
      { employeeId: 'emp-1' },
      {},
      { ...baseContext, manager: manager as any },
    );

    expect(scopedBadgeGrantRepo.insert).toHaveBeenCalled();
    expect(plainBadgeGrantRepo.insert).not.toHaveBeenCalled();
    expect(plainAssignmentRepo.count).not.toHaveBeenCalled();
    expect(plainBadgeCatalogRepo.find).not.toHaveBeenCalled();
  });


});
