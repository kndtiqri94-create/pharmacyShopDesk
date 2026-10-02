import { UserRole } from '../../enums/user-role.enum';
import { PaginationDto } from '../pagination.dto';

export interface SearchUsersDto extends PaginationDto {
  searchTerm?: string;
  role?: UserRole;
  isActive?: boolean;
}
