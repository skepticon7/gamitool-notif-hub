import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMissionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  xpGranted?: number;
}
