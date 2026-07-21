import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateEventLinkDto {
  @IsString()
  @IsNotEmpty()
  sourceEvent: string;

  @IsString()
  @IsNotEmpty()
  action: string;

  @IsObject()
  params: Record<string, any>;

  @IsOptional()
  @IsString()
  targetEvent?: string;
}
