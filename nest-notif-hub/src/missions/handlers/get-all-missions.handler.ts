import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetAllMissionsQuery } from '../queries/get-all-missions.query';
import { MissionEntity } from '../entities/mission.entity';

@QueryHandler(GetAllMissionsQuery)
export class GetAllMissionsHandler implements IQueryHandler<GetAllMissionsQuery> {
  constructor(
    @InjectRepository(MissionEntity)
    private readonly missionRepo: Repository<MissionEntity>,
  ) {}

  execute(): Promise<MissionEntity[]> {
    return this.missionRepo.find();
  }
}
