import Redis from 'ioredis';
import { EVENT_STREAM } from '../../src/shared/redis/redis.constants';
import { ActivityFeedConsumer } from '../../src/activity-feed/services/activity-feed.consumer';

// Duplicated by hand — this is a private, non-exported constant inside
// activity-feed.consumer.ts. If that string ever changes there without this
// test being updated too, XGROUP DESTROY below would silently no-op
// (destroying a group name that no longer exists) and this test would keep
// passing for the wrong reason.
const CONSUMER_GROUP = 'activity-feed';

// INTEGRATION test: real Redis. Proves the actual NOGROUP recovery path —
// ensureConsumerGroup() really recreates the group on the server, not just
// "the code called a function that claims to." Everything else is faked;
// this test is scoped to one named consumer group, never any business data,
// so unlike reminder-sweep.integration-spec.ts there's no risk of touching
// real rows — only a transient, self-healing hiccup to the group itself,
// which the live app (if running) would also recover from on its own.
describe('ActivityFeedConsumer (integration) — NOGROUP self-healing', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    });
  });

  afterAll(() => {
    redis.disconnect(); // NOT .quit() — see the cleanup note in step 6 below
  });

  it('recreates the consumer group and replays recent events after a NOGROUP error', async () => {
    // 1. Force the failure.
    await redis.xgroup('DESTROY', EVENT_STREAM, CONSUMER_GROUP).catch(() => {
      // fine if it didn't exist yet
    });

    // 2. Fake everything except redis.
    const fakeActivityModel = { updateOne: jest.fn(), exists: jest.fn().mockResolvedValue(null) };
    const fakeOutboxProcessor = { replayRecent: jest.fn().mockResolvedValue(undefined) };
    const fakeNotificationGateway = { emitToEmployee: jest.fn() };
    const fakeRulesCache = { get: jest.fn().mockReturnValue([]) };
    const fakeAssignmentRepo = { findOne: jest.fn().mockResolvedValue(null) };

    const consumer = new ActivityFeedConsumer(
      redis,
      fakeActivityModel as any,
      fakeOutboxProcessor as any,
      fakeNotificationGateway as any,
      fakeRulesCache as any,
      fakeAssignmentRepo as any,
    );

    // 3. Trigger the real self-healing code, unawaited — loop() runs
    // forever by design, same as it does for the app's whole lifetime.
    (consumer as any).running = true;
    (consumer as any).loop();

    // 4. Give the catch -> ensureConsumerGroup() -> replayRecent() sequence
    // a moment — quick Redis round-trips, not a blocking wait.
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 5a. Behavior: did the real catch block run?
    expect(fakeOutboxProcessor.replayRecent).toHaveBeenCalledTimes(1);

    // 5b. Real state: query Redis fresh, don't trust the mock alone.
    const groups = await redis.xinfo('GROUPS', EVENT_STREAM);
    expect(JSON.stringify(groups)).toContain(CONSUMER_GROUP);

    // 6. Stop cleanly. After step 3 healed the group, loop() immediately
    // issued a real BLOCKING XREADGROUP ... BLOCK 5000 that won't return on
    // its own for up to 5s. Flip `running` (checked only once that call
    // returns) AND kill the connection so the block errors out immediately
    // instead of the test waiting on it.
    (consumer as any).running = false;
  });
});
