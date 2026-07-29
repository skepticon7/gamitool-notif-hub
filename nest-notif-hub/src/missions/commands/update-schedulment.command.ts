import { RecurrenceInterval } from '../entities/mission-schedulment.entity';

export class UpdateSchedulmentCommand {
  constructor(
    public readonly id: string,
    public readonly recurrenceInterval?: RecurrenceInterval,
    // Whole-array replacement, PATCH-style — same pattern UpdateMissionDto
    // already uses for its fields. Adding/removing an employee just means
    // sending the new full list, no separate add/remove endpoints.
    public readonly employeeIds?: string[],
  ) {}
}
