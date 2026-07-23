import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeleteMissionCommand } from '../commands/delete-mission.command';
import { MissionEntity } from '../entities/mission.entity';

@CommandHandler(DeleteMissionCommand)
export class DeleteMissionHandler implements ICommandHandler<DeleteMissionCommand> {
  constructor(
    @InjectRepository(MissionEntity)
    private readonly missionRepo: Repository<MissionEntity>,
  ) {}

  async execute(command: DeleteMissionCommand) {
    await this.missionRepo.delete({ id: command.id });
    return { deleted: true };
  }
}
