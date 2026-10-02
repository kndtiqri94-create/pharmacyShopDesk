import { OrganizationUserAllocation } from './organiztion-user-allocation.model';
import { AuditableEntryBase } from '../auditable-entry-base.model';

export interface User extends AuditableEntryBase {
  email: string;
  name: string;
  isActive: boolean;
  organizationUserAllocations: OrganizationUserAllocation[];
}
