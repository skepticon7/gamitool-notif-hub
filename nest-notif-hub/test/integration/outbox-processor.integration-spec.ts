import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { OutboxEntity } from '../../src/outbox/entities/outbox.entity';
import { OutboxRepository, OUTBOX_MAX_ATTEMPTS } from '../../src/outbox/repositories/outbox.repository';
import { OutboxProcessor } from '../../src/outbox/services/outbox.processor';
import { EventStreamPublisher } from '../../src/outbox/services/event-stream.publisher';

// This is an INTEGRATION test: it opens a real connection to the dev MySQL
// database (same one `npm run start:dev` uses) and lets OutboxRepository run
// its real SQL — the transaction, the SKIP LOCKED claim, the real status
// column updates. Nothing about MySQL is faked here.
//
// The one thing still faked is EventStreamPublisher (Redis) — that's a
// deliberate scope choice: this test is about "does the outbox correctly
// claim rows and track attempts/status in a real database," not "does Redis
// receive the message." A separate test would own that boundary.
describe('OutboxProcessor (integration)', () => {
  let dataSource: DataSource;
  let outboxRepository: OutboxRepository;
  const insertedIds: string[] = []; // track our own rows so we can clean up after

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'mysql',
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT),
      username: process.env.MYSQL_USERNAME,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      entities: [OutboxEntity],
      // The real app already ran with synchronize:true and created this
      // table — we don't need (or want) this throwaway DataSource touching
      // schema at all, just reading/writing rows.
      synchronize: false,
    });
    await dataSource.initialize();

    outboxRepository = new OutboxRepository(dataSource.getRepository(OutboxEntity), dataSource);
  });

  afterEach(async () => {
    // Clean up only the rows THIS test created, so repeated runs never
    // accumulate junk in the real dev database.
    if (insertedIds.length > 0) {
      await dataSource.getRepository(OutboxEntity).delete(insertedIds);
      insertedIds.length = 0;
    }
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  async function insertPendingRow(overrides: Partial<OutboxEntity> = {}): Promise<OutboxEntity> {
    const repo = dataSource.getRepository(OutboxEntity);
    const entity = repo.create({
      id: randomUUID(),
      eventType: 'IntegrationTestEvent',
      eventId: randomUUID(),
      correlationId: randomUUID(),
      causationId: null,
      aggregateType: null,
      aggregateId: null,
      payload: { note: 'created by outbox-processor.integration-spec.ts' },
      status: 'PENDING',
      attempts: 0,
      lastError: null,
      occurredOn: new Date(),
      publishedAt: null,
      ...overrides,
    });
    const saved = await repo.save(entity);
    insertedIds.push(saved.id);
    return saved;
  }

  it('claims a real PENDING row, publishes it, and marks it PROCESSED in the database', async () => {
    const row = await insertPendingRow();

    const fakePublisher = { publish: jest.fn().mockResolvedValue('stream-id-123') };
    const processor = new OutboxProcessor(outboxRepository, fakePublisher as unknown as EventStreamPublisher);

    await processor.process();

    // Read it back fresh from MySQL — not from any in-memory object — to
    // prove the UPDATE actually landed in the real table.
    const updated = await dataSource.getRepository(OutboxEntity).findOneByOrFail({ id: row.id });
    expect(updated.status).toBe('PROCESSED');
    expect(updated.publishedAt).not.toBeNull();
  });

  it('marks a row DEAD once its 5th publish attempt fails', async () => {
    // Start at attempts=4 — this is its last chance before the 5-attempt cap.
    const row = await insertPendingRow({ attempts: OUTBOX_MAX_ATTEMPTS - 1 });

    const fakePublisher = { publish: jest.fn().mockRejectedValue(new Error('Redis is down')) };
    const processor = new OutboxProcessor(outboxRepository, fakePublisher as unknown as EventStreamPublisher);

    await processor.process();

    const updated = await dataSource.getRepository(OutboxEntity).findOneByOrFail({ id: row.id });
    expect(updated.attempts).toBe(OUTBOX_MAX_ATTEMPTS);
    expect(updated.status).toBe('DEAD');
    expect(updated.lastError).toContain('Redis is down');
  });
});
