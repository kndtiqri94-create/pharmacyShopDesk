import { PaginationDto } from '../common/pagination.dto';

export class SearchUsersDto extends PaginationDto {
  // Search criteria
  name?: string;
  email?: string;
  role?: string;
  organizationId: number;
  searchText?: string; // Global search across name and email
  
  constructor() {
    super();
    this.sortBy = 'displayName';
  }
}
