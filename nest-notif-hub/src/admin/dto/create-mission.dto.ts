import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateMissionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(0)
  xpGranted: number;
}
