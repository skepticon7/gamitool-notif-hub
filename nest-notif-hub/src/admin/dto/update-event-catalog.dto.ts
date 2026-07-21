import { IsObject, IsOptional } from 'class-validator';

export class UpdateEventCatalogDto {
  @IsOptional()
  @IsObject()
  payloadFields?: Record<string, string>;
}
