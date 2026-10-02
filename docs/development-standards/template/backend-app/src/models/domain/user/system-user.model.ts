import { AuditableEntryBase } from '../../base/auditable-entry-base.model';
import { UserRole } from '../../enums/user-role.enum';
import { OrganizationUserAllocation } from './organiztion-user-allocation.model';

export class SystemUser extends AuditableEntryBase {
  email: string;
  name: string;
  role!: UserRole;
  isActive: boolean;
  organizationUserAllocations!: OrganizationUserAllocation[];
}
