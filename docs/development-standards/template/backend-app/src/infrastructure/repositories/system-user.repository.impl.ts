import { injectable, inject } from 'inversify';
import { Prisma, PrismaClient } from '@prisma/client';
import { ISystemUserRepository } from '../../interfaces/repositories/system-user.repository.interface';
import { SystemUser } from '../../models/domain/user/system-user.model';
import { CreateUserDto } from '../../models/dtos/user/create-user.dto';
import { UpdateUserDto } from '../../models/dtos/user/update-user.dto';
import { SearchUsersDto } from '../../models/dtos/user/search-users.dto';
import { PaginatedResponse } from '../../models/common/paginated-response.model';
import { DatabaseService } from '../../services/database/database.service';
import { SystemUserMapper } from '../../services/mappers/system-user.mapper';
import { TYPES } from '../../services/types';

@injectable()
export class SystemUserRepository implements ISystemUserRepository {
  private prisma: PrismaClient;

  constructor(@inject(TYPES.DatabaseService) databaseService: DatabaseService) {
    this.prisma = databaseService.getPrismaClient();
  }

  async findAll(): Promise<SystemUser[]> {
    const prismaUsers = await this.prisma.systemUser.findMany({
      where: { IsArchived: false },
      include: {
        OrganizationUserAllocation: {
          where: { IsArchived: false },
          include: {
            Organization: true
          }
        }
      }
    });
    return prismaUsers.map(SystemUserMapper.toDomain);
  }

  async findById(id: number): Promise<SystemUser | null> {
    const prismaUser = await this.prisma.systemUser.findFirst({
      where: { Id: id, IsArchived: false },
      include: {
        OrganizationUserAllocation: {
          where: { IsArchived: false },
          include: {
            Organization: true
          }
        }
      }
    });
    return prismaUser ? SystemUserMapper.toDomain(prismaUser) : null;
  }

  async findByEmail(email: string): Promise<SystemUser | null> {
    const prismaUser = await this.prisma.systemUser.findFirst({
      where: { Email: email, IsArchived: false },
      include: {
        OrganizationUserAllocation: {
          where: { IsArchived: false },
          include: {
            Organization: true
          }
        }
      }
    });
    return prismaUser ? SystemUserMapper.toDomain(prismaUser) : null;
  }

  async searchSystemUsers(searchDto: SearchUsersDto): Promise<PaginatedResponse<SystemUser>> {

    // Build search inputs
    const { whereClause, orderBy } = this.buildSearchInputs(searchDto);

    // Calculate skip for pagination
    const skip = (searchDto.page - 1) * searchDto.pageSize;

    // Get total count
    const totalItems = await this.prisma.systemUser.count({
      where: whereClause
    });

    // Get paginated results
    const prismaUsers = await this.prisma.systemUser.findMany({
      where: whereClause,
      orderBy,
      skip,
      take: searchDto.pageSize
    });

    const users = prismaUsers.map(SystemUserMapper.toDomain);
    return new PaginatedResponse(users, searchDto.page, searchDto.pageSize, totalItems);
  }

  private buildSearchInputs(searchDto: SearchUsersDto): {
    whereClause: Prisma.SystemUserWhereInput;
    orderBy: Prisma.SystemUserOrderByWithRelationInput;
  } {
    const { name, email, role, searchText, sortBy, sortOrder } = searchDto;

    // Build where clause
    const whereClause: Prisma.SystemUserWhereInput = {
      IsArchived: false, AND: {
        OrganizationUserAllocation: {
          some: {
            OrganizationId: searchDto.organizationId
          }
        }
      }
    };

    // Handle global search text
    if (searchText) {
      whereClause.OR = [
        {
          Name: {
            contains: searchText
          }
        },
        {
          Email: {
            contains: searchText
          }
        }
      ];
    } else {
      // Individual field searches (only if searchText is not provided)
      if (name) {
        whereClause.Name = {
          contains: name
        };
      }

      if (email) {
        whereClause.Email = {
          contains: email
        };
      }
    }

    // Build order by clause
    const orderBy: Prisma.SystemUserOrderByWithRelationInput = {};
    if (sortBy) {
      orderBy[sortBy as keyof Prisma.SystemUserOrderByWithRelationInput] = sortOrder || 'asc';
    }

    return { whereClause, orderBy };
  }

  async create(userData: CreateUserDto, currentUser: string): Promise<SystemUser> {
    return await this.prisma.$transaction(async (tx) => {
      // Create the user
      const prismaData = SystemUserMapper.fromCreateDtoToPrisma(userData, currentUser);
      const createdUser = await tx.systemUser.create({
        data: prismaData as Prisma.SystemUserCreateInput,
        include: {
          OrganizationUserAllocation: {
            include: {
              Organization: true
            }
          }
        }
      });

      if (userData.organizationId) {
        const userDepartmentData = {
          OrganizationId: userData.organizationId,
          SystemUserId: createdUser.Id,
          CreatedBy: currentUser,
          UpdatedBy: currentUser,
          AllocationKey: 'SYS'
        };

        await tx.organizationUserAllocation.create({
          data: userDepartmentData
        });

        // Fetch the user with department relationships
        const userWithOrganizationAllocations = await tx.systemUser.findUnique({
          where: { Id: createdUser.Id },
          include: {
            OrganizationUserAllocation: {
              include: {
                Organization: true
              }
            }
          }
        });

        return SystemUserMapper.toDomain(userWithOrganizationAllocations!);
      }

      return SystemUserMapper.toDomain(createdUser);
    });
  }

  async update(id: number, userData: UpdateUserDto, currentUser: string): Promise<SystemUser | null> {
    return await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.systemUser.findFirst({
        where: { Id: id, IsArchived: false }
      });

      if (!existingUser) {
        return null;
      }

      // Update the user
      const prismaData = SystemUserMapper.fromUpdateDtoToPrisma(userData, currentUser);
      const updatedUser = await tx.systemUser.update({
        where: { Id: id },
        data: prismaData,
        include: {
          OrganizationUserAllocation: {
            include: {
              Organization: true
            }
          }
        }
      });

      return SystemUserMapper.toDomain(updatedUser);
    });
  }

  async delete(id: number, currentUser: string): Promise<boolean> {
    try {
      await this.prisma.systemUser.update({
        where: { Id: id },
        data: {
          IsArchived: true,
          ArchivedBy: currentUser,
          ArchivedAt: new Date(),
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
