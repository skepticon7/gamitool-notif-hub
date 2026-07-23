import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateBadgeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  threshold?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
