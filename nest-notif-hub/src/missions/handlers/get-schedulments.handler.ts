import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetSchedulmentsQuery } from '../queries/get-schedulments.query';
import { MissionSchedulmentEntity } from '../entities/mission-schedulment.entity';

@QueryHandler(GetSchedulmentsQuery)
export class GetSchedulmentsHandler implements IQueryHandler<GetSchedulmentsQuery> {
  constructor(
    @InjectRepository(MissionSchedulmentEntity)
    private readonly schedulmentRepo: Repository<MissionSchedulmentEntity>,
  ) {}

  execute() {
    // relations: ['mission'] so the UI table can show the mission's name
    // without a second round trip per row.
    return this.schedulmentRepo.find({
      relations: { mission: true },
      order: { createdAt: 'DESC' },
    });
  }
}
