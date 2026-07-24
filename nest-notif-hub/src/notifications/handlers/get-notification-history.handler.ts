import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GetNotificationHistoryQuery } from '../queries/get-notification-history.query';
import { OutboxEntity } from '../../outbox/entities/outbox.entity';

// Reads directly off outbox_events rather than a dedicated projection —
// pragmatic for a POC: NotificationDelivered/Failed are already durably
// recorded there, and building a whole separate read model just to re-store
// the same data isn't worth it for what's ultimately a simple list view.
@QueryHandler(GetNotificationHistoryQuery)
export class GetNotificationHistoryHandler implements IQueryHandler<GetNotificationHistoryQuery> {
  constructor(
    @InjectRepository(OutboxEntity)
    private readonly outboxRepository: Repository<OutboxEntity>,
  ) {}

  async execute(query: GetNotificationHistoryQuery) {
    const rows = await this.outboxRepository.find({
      where: { eventType: In(['NotificationDelivered', 'NotificationFailed']) },
      order: { occurredOn: 'DESC' },
      take: query.limit,
    });

    return rows.map((row) => ({
      employeeId: row.payload.employeeId,
      channel: row.payload.channel,
      status: row.eventType === 'NotificationDelivered' ? 'delivered' : 'failed',
      errorReason: row.payload.errorReason ?? null,
      occurredOn: row.occurredOn,
    }));
  }
}
