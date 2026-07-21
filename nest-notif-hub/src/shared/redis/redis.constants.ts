export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

// One shared stream for every business event. Event type travels in the message
// so newly registered event types need no new subscription.
export const EVENT_STREAM = 'stream:events';
