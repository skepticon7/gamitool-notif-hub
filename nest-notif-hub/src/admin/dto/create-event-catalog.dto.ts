import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateEventCatalogDto {
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @IsObject()
  payloadFields: Record<string, string>;
}
