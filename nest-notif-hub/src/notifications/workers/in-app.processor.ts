import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { InAppNotificationEntity } from '../entities/in-app-notification.entity';
import { DataSource, Repository } from 'typeorm';
import { NotificationGateway } from '../../websocket/notification.gateway';
import { OutboxRepository } from '../../outbox/repositories/outbox.repository';

@Processor('in-app')
export class InAppProcessor extends WorkerHost{

  private readonly logger : Logger = new Logger(InAppProcessor.name);
  constructor(
    @InjectRepository(InAppNotificationEntity)
    private readonly inAppNotificationRepository: Repository<InAppNotificationEntity>,
    private readonly notificationGateway : NotificationGateway,
    private readonly outboxRepository: OutboxRepository,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  async process(job : Job) : Promise<void> {
    const {recipient , message , correlationId , employeeId , kind , sourceEventId} = job.data;
    const notification = {
      id: randomUUID(),
      employeeId,
      correlationId,
      sourceEventId,
      kind,
      message,
      jobId: job.id!,
      createdAt: new Date(),
    }
    try{
      await this.inAppNotificationRepository.insert(notification);
    }catch (e: any) {
      if(e?.code === 'ER_DUP_ENTRY') {
        this.logger.warn(
          `[IN-APP] job ${job.id} already recorded, skipping insert`,
        );
      } else {
        // Only record NotificationFailed once retries are exhausted — same
        // reasoning as N8nProcessor: a transient failure that succeeds on a
        // later attempt should never leave behind a false "failed" record.
        const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
        if (isFinalAttempt) {
          try {
            await this.outboxRepository.create(this.dataSource.manager, {
              eventType: 'NotificationFailed',
              eventId: randomUUID(),
              correlationId,
              causationId: sourceEventId,
              aggregateType: 'Notification',
              aggregateId: employeeId,
              occurredOn: new Date(),
              payload: {
                employeeId,
                channel: 'in-app',
                correlationId,
                sourceEventId,
                errorReason: e instanceof Error ? e.message : String(e),
              },
            });
          } catch (trackingError) {
            this.logger.warn(
              `Failed to record NotificationFailed for ${correlationId}: ${trackingError instanceof Error ? trackingError.message : trackingError}`,
            );
          }
        }
        throw e;
      }
    }

    this.notificationGateway.emitToEmployee(employeeId , 'notification:new' , {
      id: notification.id,
      message: notification.message,
      kind: notification.kind,
      read: false,
      createdAt: notification.createdAt,
    })

    // Delivered successfully (fresh insert or an already-recorded retry) —
    // deliberately isolated in its own try/catch, same as N8nProcessor: the
    // real "send" already succeeded by this point, so a tracking-write
    // failure must never fail this job and trigger a duplicate real insert.
    try {
      await this.outboxRepository.create(this.dataSource.manager, {
        eventType: 'NotificationDelivered',
        eventId: randomUUID(),
        correlationId,
        causationId: sourceEventId,
        aggregateType: 'Notification',
        aggregateId: employeeId,
        occurredOn: new Date(),
        payload: { employeeId, channel: 'in-app', correlationId, sourceEventId },
      });
    } catch (trackingError) {
      this.logger.warn(
        `Failed to record NotificationDelivered for ${correlationId} (delivery itself succeeded): ${trackingError instanceof Error ? trackingError.message : trackingError}`,
      );
    }

    this.logger.log(
        `[IN-APP] -> ${recipient}: "${message}" (correlationId: ${correlationId}, attempt ${job.attemptsMade + 1})`,
    );
  }
}