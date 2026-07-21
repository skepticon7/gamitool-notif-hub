import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { MissionActionDto } from './dto/mission-action.dto';
import { AssignMissionCommand } from './commands/assign-mission.command';
import { CompleteMissionCommand } from './commands/complete-mission.command';

// No auth guard yet — same open-endpoint gap as the /admin controllers.
// Fine for local trigger/demo use, not for anything beyond that.
@Controller('missions')
export class MissionsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('assign')
  assign(@Body() dto: MissionActionDto) {
    return this.commandBus.execute(
      new AssignMissionCommand(dto.employeeId, dto.missionId),
    );
  }

  @Post('complete')
  complete(@Body() dto: MissionActionDto) {
    return this.commandBus.execute(
      new CompleteMissionCommand(dto.employeeId, dto.missionId),
    );
  }
}
