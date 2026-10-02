import { AuditableEntryBase } from '../../base/auditable-entry-base.model';

export class OrganizationUserAllocation extends AuditableEntryBase {
  systemUserId!: number;
  organizationId!: number;
  allocationKey!: string;
  isActive!: boolean;
}
