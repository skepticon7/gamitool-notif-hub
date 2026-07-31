import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Registers BullMQ's shared connection once, at the root — feature modules
// then just call BullModule.registerQueue({ name: ... }) without repeating
// connection config. Reuses the same Redis instance as the event stream.
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          // Same reasoning as RedisModule's REDIS_CLIENT: must track the
          // same logical DB, or a second app instance sharing Redis DB 0
          // (e.g. a live dev server running concurrently) can steal and
          // process this instance's jobs on its own worker — delivering a
          // WebSocket push through a completely different server than the
          // one that enqueued it.
          db: config.get<number>('REDIS_DB', 0),
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class BullmqModule {}
