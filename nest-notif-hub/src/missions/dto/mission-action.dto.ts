import { IsNotEmpty, IsString } from 'class-validator';

// Same shape for both assign and complete — both just need to identify who
// and what. No Mission entity backs this; missionId is a plain business key
// the reminder-cancellation matching and the event payload both key off.
export class MissionActionDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  missionId: string;
}
