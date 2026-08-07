import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { InAppNotificationEntity } from '../../src/notifications/entities/in-app-notification.entity';
import { NotifyAction } from '../../src/notifications/actions/notify.action';
import { ActionContext } from '../../src/rule-engine/actions/action.interface';

// INTEGRATION test: real MySQL backs `in_app_notifications` — specifically
// its `jobId` unique constraint, which is the actual dedupe mechanism this
// test exists to prove. NotifyAction delivers the in-app channel inline now
// (no BullMQ queue/InAppProcessor anymore — see notify.action.ts for why),
// so "redelivered twice" here means calling execute() twice with the same
// (eventId, ruleId), same as a real replay of the same rule-engine
// transaction would produce. Everything except the real
// Repository<InAppNotificationEntity> is faked, same "fake what this test
// isn't about" reasoning as the other integration tests.
describe('NotifyAction (integration) — in-app jobId dedupe', () => {
  let dataSource: DataSource;
  const insertedJobIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'mysql',
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT),
      username: process.env.MYSQL_USERNAME,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      entities: [InAppNotificationEntity],
      synchronize: false,
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    if (insertedJobIds.length > 0) {
      await dataSource
        .getRepository(InAppNotificationEntity)
        .createQueryBuilder()
        .delete()
        .where('jobId IN (:...ids)', { ids: insertedJobIds })
        .execute();
      insertedJobIds.length = 0;
    }
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('inserts exactly one row even when the same (event, rule) is delivered twice', async () => {
    const eventId = randomUUID();
    const ruleId = randomUUID();
    const jobId = `${eventId}:${ruleId}:in-app`;
    insertedJobIds.push(jobId);

    const context: ActionContext = {
      eventId,
      ruleId,
      correlationId: randomUUID(),
    };

    const fakeEmployeeRepo = {
      findOneByOrFail: jest.fn().mockResolvedValue({
        id: 'emp-1',
        name: 'Integration Test Employee',
      }),
    };
    const fakeN8nQueue = { add: jest.fn() };
    const fakeGateway = { emitToEmployee: jest.fn() };
    const fakeOutboxRepository = {
      create: jest.fn().mockResolvedValue(undefined),
      notifyWake: jest.fn().mockResolvedValue(undefined),
    };

    const action = new NotifyAction(
      fakeN8nQueue as any,
      fakeEmployeeRepo as any,
      dataSource.getRepository(InAppNotificationEntity), // real — the unique jobId constraint lives here
      fakeGateway as any,
      fakeOutboxRepository as any,
    );

    const payload = { employeeId: 'emp-1' };
    const params = { channels: ['in-app'], message: 'Integration test notification' };

    // Same (event, rule) delivered twice — simulates a replay of the same
    // rule-engine transaction (e.g. after a NOGROUP self-heal).
    await action.execute(payload, params, context);
    await action.execute(payload, params, context);

    const count = await dataSource.getRepository(InAppNotificationEntity).count({
      where: { jobId },
    });
    expect(count).toBe(1);
    expect(fakeGateway.emitToEmployee).toHaveBeenCalledTimes(1);
  });
});
