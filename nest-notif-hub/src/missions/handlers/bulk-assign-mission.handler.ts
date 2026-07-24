import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpStatus } from '@nestjs/common';
import { BulkAssignMissionCommand } from '../commands/bulk-assign-mission.command';
import { AssignMissionCommand } from '../commands/assign-mission.command';
import { EmployeeUserEntity } from '../../users/entities/employee-user.entity';
import { MissionEntity } from '../entities/mission.entity';
import { BusinessException } from '../../shared/exceptions/business.exception';

// Deliberately reuses AssignMissionCommand per employee via CommandBus,
// rather than a bespoke bulk-insert — this way every safety check
// AssignMissionHandler already has (employee exists, mission exists,
// already-assigned, deadline computation) applies identically here, with
// zero duplicated logic. "Already assigned" is expected and skipped, not
// treated as a bulk-operation failure — the point of this endpoint is
// "make sure everyone has it," not "everyone must not have had it already."
@CommandHandler(BulkAssignMissionCommand)
export class BulkAssignMissionHandler implements ICommandHandler<BulkAssignMissionCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    @InjectRepository(EmployeeUserEntity)
    private readonly employeeRepo: Repository<EmployeeUserEntity>,
    @InjectRepository(MissionEntity)
    private readonly missionRepo: Repository<MissionEntity>,
  ) {}

  async execute(command: BulkAssignMissionCommand) {
    const mission = await this.missionRepo.findOneBy({ id: command.missionId });
    if (!mission) {
      throw new BusinessException(
        'NOT_FOUND',
        `Mission with id : ${command.missionId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const employees = await this.employeeRepo.find();

    let assigned = 0;
    let skipped = 0;

    for (const employee of employees) {
      try {
        await this.commandBus.execute(new AssignMissionCommand(command.missionId, employee.id));
        assigned++;
      } catch (error) {
        // ALREADY_EXISTS (or any other per-employee business rejection) is
        // a normal, expected outcome here — one employee's rejection must
        // never abort the rest of the batch.
        skipped++;
      }
    }

    return { missionId: command.missionId, totalEmployees: employees.length, assigned, skipped };
  }
}
