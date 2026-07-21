import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEntity } from './entities/outbox.entity';
import { OutboxRepository } from './repositories/outbox.repository';
import { OutboxProcessor } from './services/outbox.processor';
import { OutboxEventFactory } from './factory/outbox-event.factory';
import { EventStreamPublisher } from './services/event-stream.publisher';
import { CqrsModule } from '@nestjs/cqrs';
import { UserCreatedBuilder } from './builders/user-created.builder';

@Module({
  imports : [
    CqrsModule,
    TypeOrmModule.forFeature([OutboxEntity])
  ],
  providers : [UserCreatedBuilder , OutboxRepository , OutboxProcessor , OutboxEventFactory , EventStreamPublisher],
  exports : [OutboxRepository , OutboxEventFactory]
})


export class OutboxModule {}