import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateAccountCommand } from '../../commands/create-account.command';
import { CreateUserCommand } from '../../commands/create-user.command';
import { AuthentikService } from '../../../infrastructure/authentik/authentik.service';
import { UserEntity } from '../../entities/user.entity';

// The only place a UserEntity ever gets created going forward — see
// AuthService.resolveUser, which now rejects any login whose `sub` wasn't
// provisioned through here (or the one-time admin bootstrap seed). With STI,
// this is a single row regardless of role — no separate Employee insert.
@CommandHandler(CreateAccountCommand)
export class CreateAccountHandler implements ICommandHandler<CreateAccountCommand> {
  constructor(
    private readonly authentikService: AuthentikService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: CreateAccountCommand) {
    // Authentik only proves identity — role is never assigned there.
    const { sub, temporaryPassword } = await this.authentikService.createUser(
      command.email,
      command.name,
    );

    const user: UserEntity = await this.commandBus.execute(
      new CreateUserCommand(sub, command.email, command.name, command.role),
    );

    // temporaryPassword only ever surfaces here — the admin relays it to the
    // employee out of band. No email/SMS invite flow yet (deferred).
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: command.role,
      temporaryPassword,
    };
  }
}
