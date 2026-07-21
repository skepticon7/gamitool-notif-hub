import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor("sms")
export class SmsProcessor extends WorkerHost{

  private readonly logger : Logger = new Logger(SmsProcessor.name);

  async process(job : Job) : Promise<void> {
    const {recipient , message , correlationId} = job.data;
    this.logger.log(
      `[SMS] -> ${recipient}: "${message}" (correlationId: ${correlationId}, attempt ${job.attemptsMade + 1})`
    )
  }

}