import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Job } from 'bullmq';
import { InAppNotificationEntity } from '../../src/notifications/entities/in-app-notification.entity';
import { InAppProcessor } from '../../src/notifications/workers/in-app.processor';

// INTEGRATION test: real MySQL backs `in_app_notifications` — specifically
// its `jobId` unique constraint, which is the actual dedupe mechanism this
// test exists to prove. BullMQ itself is faked (a plain object shaped like
// a Job) since we're not testing the queue, just process()'s own logic; the
// socket gateway and outbox tracking writes are faked too, same "fake what
// this test isn't about" reasoning as the other integration tests.
describe('InAppProcessor (integration) — jobId dedupe', () => {
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

  it('inserts exactly one row even when the same job is processed twice', async () => {
    const jobId = `integration-test-${randomUUID()}`;
    insertedJobIds.push(jobId);

    const job = {
      id: jobId,
      data: {
        recipient: 'test@example.com',
        message: 'Integration test notification',
        correlationId: randomUUID(),
        employeeId: 'emp-1',
        kind: 'general',
        sourceEventId: randomUUID(),
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as unknown as Job;

    const fakeGateway = { emitToEmployee: jest.fn() };
    const fakeOutboxRepository = { create: jest.fn().mockResolvedValue(undefined) };

    const processor = new InAppProcessor(
      dataSource.getRepository(InAppNotificationEntity), // real — the unique jobId constraint lives here
      fakeGateway as any,
      fakeOutboxRepository as any,
      dataSource, // real, just so `this.dataSource.manager` resolves to something valid
    );

    // Same job, processed twice — simulates a BullMQ retry/redelivery of
    // the exact same job.
    await processor.process(job);
    await processor.process(job);

    const count = await dataSource.getRepository(InAppNotificationEntity).count({
      where: { jobId },
    });
    expect(count).toBe(1);
  });
});
