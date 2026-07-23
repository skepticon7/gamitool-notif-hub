import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';
import type { UserRole } from '../../users/entities/user.entity';

export class CreateAccountDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['admin', 'employee'])
  role: UserRole;
}
