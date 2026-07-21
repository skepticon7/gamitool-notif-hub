export class CreateUserCommand {
  constructor(
    public readonly sub: string,
    public readonly email: string,
    public readonly name: string,
  ) {
  }
}