import { EventLinkGraphValidator } from './event-link-graph-validator.service';
import { BusinessException } from '../../shared/exceptions/business.exception';

describe('EventLinkGraphValidator', () => {
  // catalog: eventType -> payloadFields object (keys are what matters, values unused)
  function makeValidator(opts: {
    catalog: Record<string, Record<string, string>>;
    action: { requiredPayloadFields: string[]; allowedSourceEvents: string[] };
    existingLinks?: { id: string; sourceEvent: string; targetEvent: string | null }[];
    actionThrows?: boolean;
  }) {
    const catalogRepo = {
      findOneBy: jest.fn().mockImplementation(({ eventType }: { eventType: string }) =>
        opts.catalog[eventType] ? { eventType, payloadFields: opts.catalog[eventType] } : null,
      ),
    };
    const linkRepo = {
      find: jest.fn().mockResolvedValue(opts.existingLinks ?? []),
    };
    const actionRegistry = {
      get: jest.fn().mockImplementation(() => {
       if(opts.actionThrows) throw new Error('No action registered');
       return opts.action;
      }),
    };
    return new EventLinkGraphValidator(catalogRepo as any, linkRepo as any, actionRegistry as any);
  }

  it('rejects a wiring missing a required payload field', async () => {
    const validator = makeValidator({
      catalog: { MissionAssigned: { employeeId: 'string' } }, // no xpGranted
      action: { requiredPayloadFields: ['employeeId', 'xpGranted'], allowedSourceEvents: ['MissionAssigned'] },
    });

    await expect(
      validator.validate({ sourceEvent: 'MissionAssigned', action: 'GrantXP', targetEvent: null }),
    ).rejects.toMatchObject({ errorCode: 'INCOMPATIBLE_WIRING' } as Partial<BusinessException>);
  });

  it('rejects a wiring whose source event is not in the action\'s allowedSourceEvents', async () => {
    const validator = makeValidator({
      catalog: { MissionAssigned: { employeeId: 'string' } },
      action: { requiredPayloadFields: ['employeeId'], allowedSourceEvents: ['MissionCompleted'] },
    });

    await expect(
      validator.validate({ sourceEvent: 'MissionAssigned', action: 'GrantBadge', targetEvent: null }),
    ).rejects.toMatchObject({ errorCode: 'INCOMPATIBLE_SOURCE_EVENT' } as Partial<BusinessException>);
  });

  it('rejects a wiring that would close a cycle back to its own source event', async () => {
    const validator = makeValidator({
      catalog: { A: {}, B: {} },
      action: { requiredPayloadFields: [], allowedSourceEvents: ['*'] },
      // an existing link B -> A already exists; wiring A -> B would close the loop
      existingLinks: [{ id: 'link-x', sourceEvent: 'B', targetEvent: 'A' }],
    });

    await expect(
      validator.validate({ sourceEvent: 'A', action: 'EmitEvent', targetEvent: 'B' }),
    ).rejects.toMatchObject({ errorCode: 'CYCLE_DETECTED' } as Partial<BusinessException>);
  });

  it('accepts a compatible wiring with no target event', async () => {
    const validator = makeValidator({
      catalog: { MissionCompleted: { employeeId: 'string', xpGranted: 'number' } },
      action: { requiredPayloadFields: ['employeeId', 'xpGranted'], allowedSourceEvents: ['MissionCompleted'] },
    });

    await expect(
      validator.validate({ sourceEvent: 'MissionCompleted', action: 'GrantXP', targetEvent: null }),
    ).resolves.toBeUndefined();
  });


  it("rejects a source event that isn't in the catalog at all" , async  () => {
    const validator = makeValidator({
      catalog : {},
      action : {requiredPayloadFields: [] , allowedSourceEvents: ['*']}
    });
    await expect(
      validator.validate({sourceEvent : 'Ghost' , action : 'Notify' , targetEvent : null}),
    ).rejects.toMatchObject({errorCode: 'UNKNOWN_SOURCE_EVENT'})
  })

  it('rejects an action that is not registered', async () => {
    const validator = makeValidator({
      catalog: { MissionCompleted: { employeeId: 'string' } },
      action: {requiredPayloadFields : [] , allowedSourceEvents: ['*'] },
      actionThrows: true
    });

    await expect(
      validator.validate({
        sourceEvent: 'MissionCompleted',
        action: 'GhostAction',
        targetEvent: null,
      }),
    ).rejects.toMatchObject({ errorCode: 'UNKNOWN_ACTION' });
  });


  it('rejects a Notify template referencing a field the source event does not declare'  ,async  () => {
    const validator = makeValidator({
      catalog : {ReminderDue: {employeeId: 'string' , missionId : 'string'}},
      action: {requiredPayloadFields : ['employeeId'] , allowedSourceEvents: ['*'] },
    })

    await expect(
      validator.validate({
        sourceEvent : 'ReminderDue',
        action: 'Notify',
        targetEvent : null,
        params: {message : 'Expires in {{daysLeft}} days'}
      })
    ).rejects.toMatchObject({errorCode : 'INCOMPATIBLE_TEMPLATE'})

  })


  it('rejects a target event that is not in the catalog', async () => {
    const validator = makeValidator({
      catalog: { MissionCompleted: { employeeId: 'string' } },
      action: {
        requiredPayloadFields: ['employeeId'],
        allowedSourceEvents: ['MissionCompleted'],
      },
    });

    await expect(
      validator.validate({
        sourceEvent: 'MissionCompleted',
        action: 'GrantBadge',
        targetEvent: 'Ghost',
      }),
    ).rejects.toMatchObject({ errorCode: 'UNKNOWN_TARGET_EVENT' });
  });




});
