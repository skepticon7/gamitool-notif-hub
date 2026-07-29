import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSchedulmentDto {
  @IsUUID()
  missionId: string;

  @IsIn(['daily', 'weekly', 'monthly'])
  recurrenceInterval: 'daily' | 'weekly' | 'monthly';

  @IsIn(['all', 'specific'])
  scope: 'all' | 'specific';

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  employeeIds?: string[];
}
