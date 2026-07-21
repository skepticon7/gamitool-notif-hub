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
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class BullmqModule {}
