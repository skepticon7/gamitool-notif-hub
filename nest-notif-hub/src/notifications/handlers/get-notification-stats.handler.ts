import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GetNotificationStatsQuery } from '../queries/get-notification-stats.query';
import { OutboxEntity } from '../../outbox/entities/outbox.entity';
import { InAppNotificationEntity } from '../entities/in-app-notification.entity';

// Reads directly off outbox_events, same pragmatism as
// GetNotificationHistoryHandler — no dedicated projection table for what's
// ultimately a simple aggregation over data that's already durably stored.
@QueryHandler(GetNotificationStatsQuery)
export class GetNotificationStatsHandler implements IQueryHandler<GetNotificationStatsQuery> {
  constructor(
    @InjectRepository(OutboxEntity)
    private readonly outboxRepository: Repository<OutboxEntity>,
    @InjectRepository(InAppNotificationEntity)
    private readonly inAppNotificationRepository: Repository<InAppNotificationEntity>,
  ) {}

  async execute() {
    const rows = await this.outboxRepository.find({
      where: { eventType: In(['NotificationDelivered', 'NotificationFailed']) },
    });

    const stats: Record<string, { delivered: number; failed: number }> = {};
    for (const row of rows) {
      const channel = row.payload?.channel ?? 'unknown';
      stats[channel] ??= { delivered: 0, failed: 0 };
      if (row.eventType === 'NotificationDelivered') {
        stats[channel].delivered++;
      } else {
        stats[channel].failed++;
      }
    }

    // in_app_notifications is the durable, always-consistent record of every
    // successful in-app delivery — the row's existence IS the delivery, with
    // no separate tracking step left to silently fail afterward. Prefer it
    // over the NotificationDelivered outbox event (written by InAppProcessor
    // in an isolated try/catch that can drop) for this one number. `failed`
    // has no equivalent primary source — a fully-exhausted in-app job leaves
    // no row anywhere, so it keeps relying on the outbox tracking event.
    stats['in-app'] ??= { delivered: 0, failed: 0 };
    stats['in-app'].delivered = await this.inAppNotificationRepository.count();

    return stats;
  }
}
