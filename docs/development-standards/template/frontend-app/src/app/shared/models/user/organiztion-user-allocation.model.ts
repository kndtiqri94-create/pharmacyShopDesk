import { AuditableEntryBase } from '../auditable-entry-base.model';

export interface OrganizationUserAllocation extends AuditableEntryBase {
  systemUserId: number;
  organizationId: number;
  allocationKey: string;
  isActive: boolean;
}
