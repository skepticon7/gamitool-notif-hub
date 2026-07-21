import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateEventLinkDto {
  @IsOptional()
  @IsString()
  sourceEvent?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  @IsOptional()
  @IsString()
  targetEvent?: string | null;
}
