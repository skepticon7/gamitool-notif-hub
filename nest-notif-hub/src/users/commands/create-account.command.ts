import { UserRole } from '../entities/user.entity';

export class CreateAccountCommand {
  constructor(
    public readonly email: string,
    public readonly name: string,
    public readonly role: UserRole,
  ) {}
}
