import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { OutboxEntity } from '../../src/outbox/entities/outbox.entity';
import { OutboxRepository } from '../../src/outbox/repositories/outbox.repository';
import { ProcessedEventsEntity } from '../../src/rule-engine/entities/processed-events.entity';
import { EventLinkEntity } from '../../src/rule-engine/entities/event-link.entity';
import { RulesCache } from '../../src/rule-engine/services/rules-cache';
import { RuleEngineConsumer } from '../../src/rule-engine/services/rule-engine.consumer';

// INTEGRATION test: real MySQL backs `event_links` and `processed_events` —
// the actual idempotency mechanism this test exists to prove. Redis and the
// action itself are faked, same "fake what this test isn't about" reasoning
// as outbox-processor.integration-spec.ts.
describe('RuleEngineConsumer (integration) — idempotency', () => {
  const SOURCE_EVENT = 'IntegrationTestSourceEvent';

  let dataSource: DataSource;
  let rulesCache: RulesCache;
  let outboxRepository: OutboxRepository;
  let eventLinkId: string;
  const insertedEventIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'mysql',
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT),
      username: process.env.MYSQL_USERNAME,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      entities: [OutboxEntity, ProcessedEventsEntity, EventLinkEntity],
      synchronize: false,
    });
    await dataSource.initialize();

    const fakeRedisClient = { publish: jest.fn().mockResolvedValue(1) };
    outboxRepository = new OutboxRepository(
      dataSource.getRepository(OutboxEntity),
      dataSource,
      fakeRedisClient as any,
    );
    rulesCache = new RulesCache(dataSource.getRepository(EventLinkEntity));

    const link = await dataSource.getRepository(EventLinkEntity).save({
      sourceEvent: SOURCE_EVENT,
      action: 'FakeAction',
      params: {},
      targetEvent: null,
    });
    eventLinkId = link.id;
    await rulesCache.reload();
  });

  afterEach(async () => {
    if (insertedEventIds.length > 0) {
      await dataSource
        .getRepository(ProcessedEventsEntity)
        .createQueryBuilder()
        .delete()
        .where('eventId IN (:...ids)', { ids: insertedEventIds })
        .execute();
      insertedEventIds.length = 0;
    }
  });

  afterAll(async () => {
    await dataSource.getRepository(EventLinkEntity).delete(eventLinkId);
    await dataSource.destroy();
  });

  function buildFakeAction() {
    return {
      actionType: 'FakeAction',
      requiredPayloadFields: [],
      allowedSourceEvents: ['*'],
      execute: jest.fn().mockResolvedValue({ shouldEmit: false }),
    };
  }

  it('executes the action and records a processed_events row on first delivery', async () => {

    const fakeAction = buildFakeAction();
    const fakeActionRegistry = { get: jest.fn().mockReturnValue(fakeAction) };
    const eventId = randomUUID();
    insertedEventIds.push(eventId);

    const consumer = new RuleEngineConsumer(
      { xack: jest.fn() } as any,
      rulesCache,
      dataSource.getRepository(ProcessedEventsEntity),
      fakeActionRegistry as any,
      outboxRepository,
      {} as any,
      dataSource,
    );

    const message = {
      id: '1-0',
      fields: {
        eventId,
        eventType: SOURCE_EVENT,
        correlationId: randomUUID(),
        aggregateType: '',
        aggregateId: '',
        payload: JSON.stringify({}),
      },
    };

    await (consumer as any).handle(message);

    expect(fakeAction.execute).toHaveBeenCalledTimes(1);

    const row = await dataSource.getRepository(ProcessedEventsEntity).findOneBy({
      consumerGroup: 'rule-engine',
      eventId,
      ruleId: eventLinkId,
    });
    expect(row).not.toBeNull();
  });

  it('does NOT re-execute the action when processed_events has this (event , rule)' , async () => {

    const fakeAction = buildFakeAction();
    const fakeActionRegistry = {get: jest.fn().mockReturnValue(fakeAction)};
    const eventId = randomUUID();
    insertedEventIds.push(eventId);

    // Simulate "a prior delivery of this exact message already completed
    // this exact rule" by pre-inserting the dedupe row BEFORE calling
    // handle(), instead of checking for it after (that's Case A).
    await dataSource.getRepository(ProcessedEventsEntity).insert({
      consumerGroup: 'rule-engine',
      eventId,
      ruleId: eventLinkId,
    });

    const consumer = new RuleEngineConsumer(
      {xack: jest.fn() } as any,
      rulesCache,
      dataSource.getRepository(ProcessedEventsEntity),
      fakeActionRegistry as any,
      outboxRepository,
      {} as any,
      dataSource
    );

    const message = {
      id: '1-0',
      fields : {
        eventId,
        eventType : SOURCE_EVENT,
        correlationId: randomUUID(),
        aggregateType: '',
        aggregateId: '',
        payload: JSON.stringify({}),
      }
    }

    await (consumer as any).handle(message);
    expect(fakeAction.execute).not.toHaveBeenCalled();

    const count = await dataSource.getRepository(ProcessedEventsEntity).count({
      where : { consumerGroup: 'rule-engine', eventId, ruleId: eventLinkId }
    });

    expect(count).toBe(1);

  })

});
