import 'dotenv/config';
import { DataSource } from 'typeorm';
import { OutboxEntity } from '../../src/outbox/entities/outbox.entity';
import { ProcessedEventsEntity } from '../../src/rule-engine/entities/processed-events.entity';
import { EventLinkEntity } from '../../src/rule-engine/entities/event-link.entity';
import { ScheduledReminderEntity } from '../../src/rule-engine/entities/scheduled-reminder.entity';
import { MissionEntity } from '../../src/missions/entities/mission.entity';
import { MissionAssignmentEntity } from '../../src/missions/entities/mission-assignment.entity';
import { UserEntity } from '../../src/users/entities/user.entity';
import { EmployeeUserEntity } from '../../src/users/entities/employee-user.entity';
import { InAppNotificationEntity } from '../../src/notifications/entities/in-app-notification.entity';

// One-off script, not part of the app itself: creates just the tables the
// integration test suite touches, via TypeORM's synchronize — same
// mechanism the real app uses on every boot, just scoped to a handful of
// entities instead of the whole app. Needed because the integration tests
// deliberately use `synchronize: false` (a throwaway DataSource shouldn't
// own schema changes against a database something else might already be
// running against) — in CI, the MySQL service container starts empty, so
// something has to create the schema once before the tests can run.
async function main() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    username: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    entities: [
      OutboxEntity,
      ProcessedEventsEntity,
      EventLinkEntity,
      ScheduledReminderEntity,
      MissionEntity,
      MissionAssignmentEntity,
      UserEntity,
      EmployeeUserEntity,
      InAppNotificationEntity,
    ],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('Schema synced for integration tests.');
  await dataSource.destroy();
}

main().catch((error) => {
  console.error('Failed to sync schema for integration tests:', error);
  process.exit(1);
});
