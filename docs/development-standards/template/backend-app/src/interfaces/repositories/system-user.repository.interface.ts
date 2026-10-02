import { SystemUser } from '../../models/domain/user/system-user.model';
import { CreateUserDto } from '../../models/dtos/user/create-user.dto';
import { UpdateUserDto } from '../../models/dtos/user/update-user.dto';
import { SearchUsersDto } from '../../models/dtos/user/search-users.dto';
import { PaginatedResponse } from '../../models/common/paginated-response.model';

export interface ISystemUserRepository {
  findAll(): Promise<SystemUser[]>;
  findById(id: number): Promise<SystemUser | null>;
  findByEmail(email: string): Promise<SystemUser | null>;
  searchSystemUsers(searchDto: SearchUsersDto): Promise<PaginatedResponse<SystemUser>>;
  create(user: CreateUserDto, currentUser: string): Promise<SystemUser>;
  update(id: number, user: UpdateUserDto, currentUser: string): Promise<SystemUser | null>;
  delete(id: number, currentUser: string): Promise<boolean>;
}
