import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateMissionCommand } from '../commands/update-mission.command';
import { MissionEntity } from '../entities/mission.entity';
import { BusinessException } from '../../shared/exceptions/business.exception';

@CommandHandler(UpdateMissionCommand)
export class UpdateMissionHandler implements ICommandHandler<UpdateMissionCommand> {
  constructor(
    @InjectRepository(MissionEntity)
    private readonly missionRepo: Repository<MissionEntity>,
  ) {}

  async execute(command: UpdateMissionCommand) {
    const existing = await this.missionRepo.findOneBy({ id: command.id });
    if (!existing) {
      throw new BusinessException(
        'MISSION_NOT_FOUND',
        `Mission ${command.id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.missionRepo.update(
      { id: command.id },
      {
        ...(command.name !== undefined && { name: command.name }),
        ...(command.xpGranted !== undefined && { xpGranted: command.xpGranted }),
        ...(command.durationDays !== undefined && { durationDays: command.durationDays }),
      },
    );
    return this.missionRepo.findOneBy({ id: command.id });
  }
}
