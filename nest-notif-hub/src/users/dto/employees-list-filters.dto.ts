import { IsIn, IsOptional } from 'class-validator';
import type { Order } from '../types/users.types';

export class EmployeesListFiltersDto {
  @IsOptional()
  level?: boolean;

  @IsOptional()
  @IsIn(['ACK', 'DESC'])
  order?: Order;
}