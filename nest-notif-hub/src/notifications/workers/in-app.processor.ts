import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('in-app')
export class InAppProcessor extends WorkerHost{
  private readonly logger : Logger = new Logger(InAppProcessor.name);
  
  async process(job : Job) : Promise<void> {
    const {recipient , message , correlationId} = job.data;
    this.logger.log(
        `[IN-APP] -> ${recipient}: "${message}" (correlationId: ${correlationId}, attempt ${job.attemptsMade + 1})`,
    );
  }
}