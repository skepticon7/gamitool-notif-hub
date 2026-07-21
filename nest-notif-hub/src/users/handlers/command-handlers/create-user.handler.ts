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
      const user = await this.mysqlRepo.create(queryRunner.manager,
        {
          sub: command.sub,
          email: command.email,
          name : command.name
        }
      );
      await this.outboxRepo.create(queryRunner.manager, {
        eventType: 'UserCreated',
        eventId: randomUUID(),
        // Root event of a new causal tree: fresh correlationId, no parent.
        // Later this should come from the inbound request via CLS instead of
        // being minted here — see [[correlation-id-propagation]].
        correlationId: randomUUID(),
        causationId: null,
        aggregateType: 'User',
        aggregateId: user.id,
        occurredOn: new Date(),
        payload: {
          id: user.id,
          sub: user.sub,
          email: user.email,
          name: user.name,
        },
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