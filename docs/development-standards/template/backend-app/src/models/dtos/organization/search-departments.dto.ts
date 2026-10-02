import { PaginationDto } from '../common/pagination.dto';

export class SearchDepartmentsDto extends PaginationDto {
  // Search criteria
  name?: string;
  code?: string;
  isFinanceDepartment?: boolean;
  isActive?: boolean;
  parentDepartmentId?: number;
  searchText?: string; // Global search across name and code
  
  constructor() {
    super();
    this.sortBy = 'name';
  }
}
