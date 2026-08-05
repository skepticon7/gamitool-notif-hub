import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';
import { REDIS_CLIENT, REDIS_STREAM_CLIENT, REDIS_WAKE_CLIENT } from './redis.constants';

function buildClient(config: ConfigService): Redis {
  return new Redis({
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: config.get<number>('REDIS_PORT', 6379),
    // Logical DB index (0-15, Redis default). Defaulting to 0 keeps
    // every existing deployment's behavior unchanged — this only
    // matters when something (e2e tests) explicitly sets REDIS_DB to
    // get a fully separate keyspace on the same Redis server, so
    // stream:events there can never collide with the real one.
    db: config.get<number>('REDIS_DB', 0),
    maxRetriesPerRequest: null,
  });
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: buildClient,
    },
    {
      provide: REDIS_STREAM_CLIENT,
      inject: [ConfigService],
      useFactory: buildClient,
    },
    {
      provide: REDIS_WAKE_CLIENT,
      inject: [ConfigService],
      useFactory: buildClient,
    },
  ],
  exports: [REDIS_CLIENT, REDIS_STREAM_CLIENT, REDIS_WAKE_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown() {
    await Promise.all([
      this.moduleRef.get<Redis>(REDIS_CLIENT).quit(),
      this.moduleRef.get<Redis>(REDIS_STREAM_CLIENT).quit(),
      this.moduleRef.get<Redis>(REDIS_WAKE_CLIENT).quit(),
    ]);
  }
}
