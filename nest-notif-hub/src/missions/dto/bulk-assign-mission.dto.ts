import { IsNotEmpty, IsString } from 'class-validator';

export class BulkAssignMissionDto {
  @IsString()
  @IsNotEmpty()
  missionId: string;
}
