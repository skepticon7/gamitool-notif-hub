import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateBadgeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(1)
  threshold: number;

  @IsOptional()
  @IsString()
  description?: string;
}
