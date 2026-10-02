import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsBoolean()
  isFinanceDepartment?: boolean;

  @IsOptional()
  @IsNumber()
  parentDepartmentId?: number;

  @IsOptional()
  @IsString()
  budgetPeriod?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
