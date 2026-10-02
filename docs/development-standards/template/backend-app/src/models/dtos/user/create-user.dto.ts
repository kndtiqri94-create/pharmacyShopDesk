import { IsEmail, IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsNumber()
  organizationId!: number;
}
