import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsBoolean()
  isFinanceDepartment?: boolean = false;

  @IsOptional()
  @IsNumber()
  parentDepartmentId?: number;

  @IsOptional()
  @IsString()
  budgetPeriod?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
