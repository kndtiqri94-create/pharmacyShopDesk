import { AuditableEntryBase } from '../auditable-entry-base.model';

export interface Organization extends AuditableEntryBase {
  code: string;
  name: string;
  userAllowedDomain: string;
  isActive: boolean;
}
