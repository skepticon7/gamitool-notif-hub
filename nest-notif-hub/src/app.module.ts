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
import { EmployeesModule } from './employees/employees.module';
import { ActivityFeedModule } from './activity-feed/activity-feed.module';

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
      // mysql2's default pool is 10, shared across the whole app. Now that
      // RuleEngineConsumer runs multiple concurrent workers, each handling
      // several events and rules in parallel, that default is too easy to
      // saturate — a burst of activity there would queue out unrelated
      // requests elsewhere (e.g. GET /employees/me) behind it. Still well
      // short of MySQL's own default max_connections (151), just real
      // headroom instead of the implicit default.
      extra: { connectionLimit: 20 },
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
    EmployeesModule,
    ActivityFeedModule,
  ],
})
export class AppModule {}
