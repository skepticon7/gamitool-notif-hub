import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from './shared/redis/redis.module';
import { BullmqModule } from './shared/queue/bullmq.module';
import { OutboxModule } from './outbox/outbox.module';
import { RuleEngineModule } from './rule-engine/rule-engine.module';
import { AdminModule } from './admin/admin.module';
import { MissionsModule } from './missions/missions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),

    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQL_HOST,
      port: 3306,
      username: process.env.MYSQL_USERNAME,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      autoLoadEntities: true,
      synchronize: true,
    }),
    MongooseModule.forRoot(process.env.MONGO_URI!),
    RedisModule,
    BullmqModule,
    AuthModule,
    CqrsModule,
    OutboxModule,
    RuleEngineModule,
    AdminModule,
    MissionsModule,
  ],
})
export class AppModule {}
