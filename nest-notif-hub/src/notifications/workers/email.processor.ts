import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job): Promise<void> {
    const { recipient, message, correlationId } = job.data;

    // Stub send — proves the enqueue -> dequeue -> retry/backoff mechanism
    // end-to-end before wiring a real provider (Nodemailer). Throwing here
    // triggers BullMQ's configured backoff exactly like a real SMTP failure
    // would.
    this.logger.log(
      `[EMAIL] -> ${recipient}: "${message}" (correlationId: ${correlationId}, attempt ${job.attemptsMade + 1})`,
    );
  }
}
