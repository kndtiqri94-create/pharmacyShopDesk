import { PaginationDto } from '../pagination.dto';

export interface SearchDepartmentsDto extends PaginationDto {
  // Search criteria
  name?: string;
  code?: string;
  isFinanceDepartment?: boolean;
  isActive?: boolean;
  parentDepartmentId?: number;
  searchText?: string; // Global search across name and code
}
