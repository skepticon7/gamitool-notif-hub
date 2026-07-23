import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMissionCommand } from '../commands/create-mission.command';
import { MissionEntity } from '../entities/mission.entity';

@CommandHandler(CreateMissionCommand)
export class CreateMissionHandler implements ICommandHandler<CreateMissionCommand> {
  constructor(
    @InjectRepository(MissionEntity)
    private readonly missionRepo: Repository<MissionEntity>,
  ) {}

  execute(command: CreateMissionCommand) {
    return this.missionRepo.save(
      this.missionRepo.create({
        name: command.name,
        xpGranted: command.xpGranted,
      }),
    );
  }
}
