import { RecurrenceInterval, SchedulmentScope } from '../entities/mission-schedulment.entity';

export class CreateSchedulmentCommand {
  constructor(
    public readonly missionId: string,
    public readonly recurrenceInterval: RecurrenceInterval,
    public readonly scope: SchedulmentScope,
    public readonly employeeIds?: string[],
  ) {}
}
