import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateUserCommand } from '../../commands/create-user.command';
import { DataSource } from 'typeorm';
import { MySqlUserRepository } from '../../repositories/mysql-user-repository';
import { OutboxRepository } from '../../../outbox/repositories/outbox.repository';
import { randomInt, randomUUID } from 'node:crypto';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand>{

  constructor(
    public readonly dataSource : DataSource,
    public readonly mysqlRepo : MySqlUserRepository,
    private readonly outboxRepo: OutboxRepository
  ) {}

  async execute(command: CreateUserCommand)  {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Employee-only defaults live here rather than as a separate insert —
      // with STI this is the same row, so there's nothing to insert twice.
      const fields =
        command.role === 'employee'
          ? {
              sub: command.sub,
              email: command.email,
              name: command.name,
              xp: 0,
              level: 1,
              phone: null,
              smsMode: 'sandbox' as const,
            }
          : {
              sub: command.sub,
              email: command.email,
              name: command.name,
            };

      const user = await this.mysqlRepo.create(queryRunner.manager, command.role, fields);

      // Two distinct event types, not one UserCreated with a role flag —
      // every wiring against EmployeeAccountCreated is guaranteed to mean
      // "a real employee", with no admin rows ever able to sneak into an
      // employee-oriented rule (e.g. Notify) via a shared event shape.
      const eventType = command.role === 'employee' ? 'EmployeeAccountCreated' : 'AdminAccountCreated';
      const payload =
        command.role === 'employee'
          ? { employeeId: user.id, email: user.email, name: user.name }
          : { userId: user.id, email: user.email, name: user.name };

      await this.outboxRepo.create(queryRunner.manager, {
        eventType,
        eventId: randomUUID(),
        // Root event of a new causal tree: fresh correlationId, no parent.
        // Later this should come from the inbound request via CLS instead of
        // being minted here — see [[correlation-id-propagation]].
        correlationId: randomUUID(),
        causationId: null,
        aggregateType: 'User',
        aggregateId: user.id,
        occurredOn: new Date(),
        payload,
      });
      await queryRunner.commitTransaction();
      return user;

    }catch(error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }finally {
      await queryRunner.release();
    }
  }

}