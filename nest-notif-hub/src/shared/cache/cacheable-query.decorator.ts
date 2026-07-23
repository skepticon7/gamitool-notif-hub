import Redis from 'ioredis';

const DEFAULT_TTL_SECONDS = 30;

// Wraps a query handler's execute() with a Redis-backed cache. Any class
// using this must inject its Redis client under the property name `redis`
// (@Inject(REDIS_CLIENT) private readonly redis: Redis) — the decorator
// runs before DI-injected properties are guaranteed set, so it reads
// `this.redis` lazily, at call time, not at decoration time.
//
// Cache key is derived from the class name + a JSON-stringified query
// object, so different filter combinations get separate cache entries.
//
// This is TTL-only — no invalidation on write. A mutation (assign/complete)
// won't be reflected until the cached entry expires. Fine for a "frequently
// read, tolerant of a few seconds of staleness" read, not for anything that
// needs to see its own write immediately.
export function CacheableQuery(ttlSeconds: number = DEFAULT_TTL_SECONDS): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = async function (this: { redis?: Redis }, query: unknown) {
      const redis = this.redis;
      if (!redis) {
        // No redis client on this handler — fail open, run uncached rather
        // than throw, so a missing wiring mistake degrades instead of breaks.
        return originalMethod.apply(this, [query]);
      }

      const cacheKey = `query-cache:${className}:${JSON.stringify(query)}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await originalMethod.apply(this, [query]);
      await redis.set(cacheKey, JSON.stringify(result), 'EX', ttlSeconds);
      return result;
    };

    return descriptor;
  };
}
