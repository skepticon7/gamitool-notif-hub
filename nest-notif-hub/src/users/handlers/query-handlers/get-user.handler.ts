import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUserQuery } from '../../queries/get-user.query';
import { MongoUserRepository } from '../../repositories/mongo-user.repository';
import { User, UserDocument } from '../../schemas/user.schema';

@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery> {

  constructor(
    private readonly mongoDbRepo: MongoUserRepository
  ) {}

  async execute(query: GetUserQuery) : Promise<User | null>  {
    return this.mongoDbRepo.findBySub(query.sub)
  }
}