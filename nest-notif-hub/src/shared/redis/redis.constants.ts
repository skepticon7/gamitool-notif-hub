export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

// Separate connection reserved for the stream consumers' blocking
// XREADGROUP...BLOCK reads. Redis responses on one connection arrive
// strictly in send order — a blocking command holds up everything queued
// behind it on the same connection until it resolves, up to the full BLOCK
// timeout. REDIS_CLIENT must stay free for fast, synchronous, user-facing
// commands (query cache reads/invalidation) that a request is waiting on.
export const REDIS_STREAM_CLIENT = Symbol('REDIS_STREAM_CLIENT');

// Separate connection reserved for OutboxProcessor's SUBSCRIBE to the
// outbox:wake channel. A subscribed connection can't be used for normal
// commands at the same time — same reasoning as REDIS_STREAM_CLIENT above,
// just for SUBSCRIBE instead of blocking XREADGROUP reads.
export const REDIS_WAKE_CLIENT = Symbol('REDIS_WAKE_CLIENT');

// Published (on REDIS_CLIENT) right after an outbox row's transaction
// commits, to wake OutboxProcessor immediately instead of waiting on a
// timer. See OutboxProcessor for how a missed/lost message is recovered.
export const OUTBOX_WAKE_CHANNEL = 'outbox:wake';

// One shared stream for every business event. Event type travels in the message
// so newly registered event types need no new subscription.
export const EVENT_STREAM = 'stream:events';
