import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GetEngineActivityQuery } from '../queries/get-engine-activity.query';
import { OutboxEntity } from '../../outbox/entities/outbox.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { formatEngineActivityMessage } from '../services/format-engine-activity-message';

// Reads outbox_events directly — every event lands there regardless of
// whether any rule matched it, so this is a true firehose, not filtered to
// what the rule engine happened to act on. No dedicated projection table,
// same pragmatism as GetNotificationHistoryHandler.
@QueryHandler(GetEngineActivityQuery)
export class GetEngineActivityHandler implements IQueryHandler<GetEngineActivityQuery> {
  constructor(
    @InjectRepository(OutboxEntity)
    private readonly outboxRepo: Repository<OutboxEntity>,
    // UserEntity (the STI base), not EmployeeUserEntity — some event types
    // (AdminAccountCreated) reference an admin, not an employee.
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async execute(query: GetEngineActivityQuery) {
    const rows = await this.outboxRepo.find({
      order: { occurredOn: 'DESC' },
      take: query.limit,
    });

    const employeeIds = [
      ...new Set(rows.map((r) => r.payload?.employeeId).filter(Boolean)),
    ];
    const users = employeeIds.length
      ? await this.userRepo.findBy({ id: In(employeeIds) })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    return rows.map((row) => ({
      eventType: row.eventType,
      message: formatEngineActivityMessage(
        row.eventType,
        row.payload,
        nameById.get(row.payload?.employeeId),
      ),
      occurredOn: row.occurredOn,
    }));
  }
}
