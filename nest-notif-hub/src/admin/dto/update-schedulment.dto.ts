import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateSchedulmentDto {
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  recurrenceInterval?: 'daily' | 'weekly' | 'monthly';

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  employeeIds?: string[];
}
