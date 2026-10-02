import { OrganizationUserAllocation } from '../../models/domain/user/organiztion-user-allocation.model';
import { SystemUser } from '../../models/domain/user/system-user.model';
import { CreateUserDto } from '../../models/dtos/user/create-user.dto';
import { UpdateUserDto } from '../../models/dtos/user/update-user.dto';

export class SystemUserMapper {
  static toDomain(prismaUser: any): SystemUser {
    const user = new SystemUser();
    user.id = prismaUser.Id;
    user.email = prismaUser.Email;
    user.name = prismaUser.Name;
    user.isActive = prismaUser.IsActive;
    user.createdAt = prismaUser.CreatedAt;
    user.createdBy = prismaUser.CreatedBy;
    user.updatedAt = prismaUser.UpdatedAt;
    user.updatedBy = prismaUser.UpdatedBy;
    user.isArchived = prismaUser.isArchived;
    user.archivedBy = prismaUser.archivedBy ?? undefined;
    user.archivedAt = prismaUser.ArchivedAt ?? undefined;

    // Map department relationships if they exist
    if (prismaUser.OrganizationUserAllocation) {
      user.organizationUserAllocations = prismaUser.OrganizationUserAllocation.map(orgUserAllocation => {
        const orgAllocation = new OrganizationUserAllocation();
        orgAllocation.systemUserId = orgUserAllocation.SystemUserId;
        orgAllocation.organizationId = orgUserAllocation.OrganizationId;
        orgAllocation.allocationKey = orgUserAllocation.AllocationKey;
        orgAllocation.isActive = orgUserAllocation.IsActive;
        orgAllocation.createdAt = orgUserAllocation.CreatedAt;
        orgAllocation.createdBy = orgUserAllocation.CreatedBy;
        orgAllocation.updatedAt = orgUserAllocation.UpdatedAt;
        orgAllocation.updatedBy = orgUserAllocation.UpdatedBy;
        orgAllocation.archivedAt = orgUserAllocation.ArchivedAt ?? undefined;
        return orgAllocation;
      });
    }

    return user;
  }

  /**
   * Creates Prisma data directly from CreateUserDto
   */
  static fromCreateDtoToPrisma(dto: CreateUserDto, currentUser: string): Partial<any> {
    return {
      Email: dto.email,
      Name: dto.name,
      ProfileId: dto.email,
      IsActive: dto.isActive ?? true,
      CreatedBy: currentUser,
      CreatedAt: new Date(),
      UpdatedBy: currentUser,
      UpdatedAt: new Date(),
    };
  }

  /**
   * Creates Prisma data directly from UpdateUserDto
   */
  static fromUpdateDtoToPrisma(dto: UpdateUserDto, currentUser: string): Partial<any> {
    const updateData: Partial<any> = {
      UpdatedBy: currentUser
    };

    if (dto.email !== undefined) updateData.Email = dto.email;
    if (dto.name !== undefined) updateData.Name = dto.name;
    if (dto.isActive !== undefined) updateData.IsActive = dto.isActive;

    return updateData;
  }
}
