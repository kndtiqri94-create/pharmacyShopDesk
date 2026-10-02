import { injectable, inject } from 'inversify';
import { CreateUserDto } from '../../models/dtos/user/create-user.dto';
import { UpdateUserDto } from '../../models/dtos/user/update-user.dto';
import { SearchUsersDto } from '../../models/dtos/user/search-users.dto';
import { PaginatedResponse } from '../../models/common/paginated-response.model';
import { TYPES } from '../types';
import { ISystemUserService } from '../../interfaces/services/system-user.service.interface';
import { ISystemUserRepository } from '../../interfaces/repositories/system-user.repository.interface';
import { SystemUser } from '../../models/domain/user/system-user.model';

@injectable()
export class SystemUserService implements ISystemUserService {
  constructor(
    @inject(TYPES.SystemUserRepository) private systemUserRepository: ISystemUserRepository
  ) {}

  async getAllSystemUsers(): Promise<SystemUser[]> {
    return await this.systemUserRepository.findAll();
  }

  async getSystemUserById(id: number): Promise<SystemUser | null> {
    return await this.systemUserRepository.findById(id);
  }

  async getSystemUserByEmail(email: string): Promise<SystemUser | null> {
    return await this.systemUserRepository.findByEmail(email);
  }

  async searchSystemUsers(searchDto: SearchUsersDto): Promise<PaginatedResponse<SystemUser>> {
    return await this.systemUserRepository.searchSystemUsers(searchDto);
  }

  async createSystemUser(userData: CreateUserDto, currentUser: string): Promise<SystemUser> {
    // Check if user with email already exists
    const existingUser = await this.systemUserRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    return await this.systemUserRepository.create(userData, currentUser);
  }

  async updateSystemUser(id: number, userData: UpdateUserDto, currentUser: string): Promise<SystemUser | null> {
    // Check if user exists
    const existingUser = await this.systemUserRepository.findById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // If email is being updated, check if it's already taken
    if (userData.email && userData.email !== existingUser.email) {
      const userWithEmail = await this.systemUserRepository.findByEmail(userData.email);
      if (userWithEmail) {
        throw new Error('User with this email already exists');
      }
    }

    return await this.systemUserRepository.update(id, userData, currentUser);
  }

  async deleteSystemUser(id: number, currentUser: string): Promise<boolean> {
    // Check if user exists
    const existingUser = await this.systemUserRepository.findById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    return await this.systemUserRepository.delete(id, currentUser);
  }
}
