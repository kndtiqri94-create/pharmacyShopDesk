import { SystemUser } from '../../models/domain/user/system-user.model';
import { CreateUserDto } from '../../models/dtos/user/create-user.dto';
import { UpdateUserDto } from '../../models/dtos/user/update-user.dto';
import { SearchUsersDto } from '../../models/dtos/user/search-users.dto';
import { PaginatedResponse } from '../../models/common/paginated-response.model';

export interface ISystemUserService {
  getAllSystemUsers(): Promise<SystemUser[]>;
  getSystemUserById(id: number): Promise<SystemUser | null>;
  getSystemUserByEmail(email: string): Promise<SystemUser | null>;
  searchSystemUsers(searchDto: SearchUsersDto): Promise<PaginatedResponse<SystemUser>>;
  createSystemUser(userData: CreateUserDto, currentUser: string): Promise<SystemUser>;
  updateSystemUser(id: number, userData: UpdateUserDto, currentUser: string): Promise<SystemUser | null>;
  deleteSystemUser(id: number, currentUser: string): Promise<boolean>;
}
