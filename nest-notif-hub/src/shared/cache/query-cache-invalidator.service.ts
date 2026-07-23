import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

// Pairs with @CacheableQuery: that decorator writes keys shaped
// `query-cache:<ClassName>:<JSON of the query>`. A write can't cheaply know
// which specific filter combinations it affects, so invalidation clears
// every cached entry for the given query class, regardless of filters —
// simple and correct, at the cost of also dropping unrelated cache hits.
@Injectable()
export class QueryCacheInvalidator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async invalidate(queryClassName: string): Promise<void> {
    const pattern = `query-cache:${queryClassName}:*`;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      cursor = nextCursor;
    } while (cursor !== '0');
  }
}
