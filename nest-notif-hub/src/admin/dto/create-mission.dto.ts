import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateMissionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(0)
  xpGranted: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;
}
