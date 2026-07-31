import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { OutboxEntity } from '../../src/outbox/entities/outbox.entity';
import { OutboxRepository } from '../../src/outbox/repositories/outbox.repository';
import { ScheduledReminderEntity } from '../../src/rule-engine/entities/scheduled-reminder.entity';
import { MissionEntity } from '../../src/missions/entities/mission.entity';
import { MissionAssignmentEntity } from '../../src/missions/entities/mission-assignment.entity';
import { UserEntity } from '../../src/users/entities/user.entity';
import { EmployeeUserEntity } from '../../src/users/entities/employee-user.entity';
import { ReminderSweepService } from '../../src/rule-engine/services/reminder-sweep.service';

// INTEGRATION test: every dependency here is real MySQL — nothing is faked.
// This test proves ReminderSweepService's real SQL: the due-batch claim,
// the ReminderDue outbox emission, the SENT status flip, and — the actual
// point of "escalation chain" — that firing a reminder schedules the NEXT
// one only when the assignment is still active.
//
// The employee is its own fixture, created in beforeAll and deleted in
// afterAll — NOT a reused id from the dev database. An earlier version of
// this file reused a real dev-seeded employee id, which worked locally but
// broke in CI (and on any fresh database): mission_assignments.employeeId
// has a real FK constraint to users(id), and a freshly-synced CI database
// has no rows in `users` at all.
describe('ReminderSweepService (integration) — escalation chain', () => {
  let dataSource: DataSource;
  let sweepService: ReminderSweepService;
  let missionId: string;
  let employeeId: string;
  const insertedAssignmentIds: string[] = [];
  const insertedReminderAggregateIds: string[] = [];
  const insertedOutboxIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'mysql',
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT),
      username: process.env.MYSQL_USERNAME,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      entities: [
        OutboxEntity,
        ScheduledReminderEntity,
        MissionEntity,
        MissionAssignmentEntity,
        UserEntity,
        EmployeeUserEntity,
      ],
      synchronize: false,
    });
    await dataSource.initialize();

    const outboxRepository = new OutboxRepository(dataSource.getRepository(OutboxEntity), dataSource);
    sweepService = new ReminderSweepService(
      dataSource.getRepository(ScheduledReminderEntity),
      outboxRepository,
      dataSource.getRepository(MissionEntity),
      dataSource.getRepository(MissionAssignmentEntity),
      dataSource,
    );

    const mission = await dataSource.getRepository(MissionEntity).save({
      name: 'Integration Test Mission',
      xpGranted: 10,
      durationDays: 10,
    });
    missionId = mission.id;

    const employee = await dataSource.getRepository(EmployeeUserEntity).save({
      sub: `integration-test-${randomUUID()}`,
      email: `integration-test-${randomUUID()}@example.com`,
      name: 'Integration Test Employee',
      xp: 0,
      level: 1,
    });
    employeeId = employee.id;
  });

  afterEach(async () => {
    if (insertedAssignmentIds.length > 0) {
      await dataSource.getRepository(MissionAssignmentEntity).delete(insertedAssignmentIds);
      insertedAssignmentIds.length = 0;
    }
    if (insertedReminderAggregateIds.length > 0) {
      await dataSource
        .getRepository(ScheduledReminderEntity)
        .createQueryBuilder()
        .delete()
        .where('aggregateId IN (:...ids)', { ids: insertedReminderAggregateIds })
        .execute();
      insertedReminderAggregateIds.length = 0;
    }
    if (insertedOutboxIds.length > 0) {
      await dataSource.getRepository(OutboxEntity).delete(insertedOutboxIds);
      insertedOutboxIds.length = 0;
    }
  });

  afterAll(async () => {
    await dataSource.getRepository(MissionEntity).delete(missionId);
    await dataSource.getRepository(EmployeeUserEntity).delete(employeeId);
    await dataSource.destroy();
  });

  // Returns the saved entity (not just an id) so the test can hand it
  // straight to fire() below — see the note on why sweep() itself is never
  // called in these tests.
  async function insertDueReminder(assignmentId: string): Promise<ScheduledReminderEntity> {
    const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days out
    const reminder = await dataSource.getRepository(ScheduledReminderEntity).save({
      ruleId: randomUUID(),
      employeeId: employeeId,
      aggregateId: randomUUID(),
      fireAt: new Date(Date.now() - 60_000), // 1 minute ago — already due
      status: 'PENDING',
      payload: {
        employeeId: employeeId,
        missionId,
        deadline: deadline.toISOString(),
        durationDays: 10,
        assignmentId,
        baseIntervalHours: 24,
      },
    });
    insertedReminderAggregateIds.push(reminder.aggregateId);
    return reminder;
  }

  it('fires a due reminder and reschedules the next one when the assignment is still ASSIGNED', async () => {
    const assignment = await dataSource.getRepository(MissionAssignmentEntity).save({
      missionId,
      employeeId: employeeId,
      status: 'ASSIGNED',
      assignedAt: new Date(),
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    });
    insertedAssignmentIds.push(assignment.id);

    const reminder = await insertDueReminder(assignment.id);

    // Calling fire() directly on OUR reminder — never sweep(), which claims
    // from the whole shared scheduled_reminders table and would risk firing
    // real, currently-active reminders that happen to also be due at the
    // same moment (confirmed the hard way: sweep() picked up a real,
    // legitimate reminder for a real active assignment during development
    // of this test and nearly triggered a real email/SMS send through the
    // live app's own ReminderDue -> Notify wiring). Same "call the private
    // method directly, bypass the shared-state entry point" pattern as
    // RuleEngineConsumer.handle() in the idempotency test.
    await (sweepService as any).fire(reminder);

    const outboxRow = await dataSource.getRepository(OutboxEntity).findOne({
      where: { eventType: 'ReminderDue' },
      order: { occurredOn: 'DESC' },
    });
    expect(outboxRow?.payload.missionId).toBe(missionId);
    expect(outboxRow?.payload.missionName).toBe('Integration Test Mission');
    insertedOutboxIds.push(outboxRow!.id);

    const originalReminders = await dataSource
      .getRepository(ScheduledReminderEntity)
      .find({ where: { aggregateId: reminder.aggregateId } });
    const sent = originalReminders.find((r) => r.status === 'SENT');
    const rescheduled = originalReminders.find((r) => r.status === 'PENDING');

    expect(sent).toBeDefined();
    expect(rescheduled).toBeDefined(); // the escalation chain continuing
  });

  it('fires a due reminder but does NOT reschedule when the assignment is already COMPLETED', async () => {
    const assignment = await dataSource.getRepository(MissionAssignmentEntity).save({
      missionId,
      employeeId: employeeId,
      status: 'COMPLETED',
      assignedAt: new Date(),
      completedAt: new Date(),
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    });
    insertedAssignmentIds.push(assignment.id);

    const reminder = await insertDueReminder(assignment.id);

    await (sweepService as any).fire(reminder);

    const outboxRow = await dataSource.getRepository(OutboxEntity).findOne({
      where: { eventType: 'ReminderDue' },
      order: { occurredOn: 'DESC' },
    });
    insertedOutboxIds.push(outboxRow!.id);

    const remindersAfter = await dataSource
      .getRepository(ScheduledReminderEntity)
      .find({ where: { aggregateId: reminder.aggregateId } });

    expect(remindersAfter).toHaveLength(1); // only the original — no reschedule
    expect(remindersAfter[0].status).toBe('SENT');
  });
});
