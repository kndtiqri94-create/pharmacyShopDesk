import { AuditableEntryBase } from '../../base/auditable-entry-base.model';
import { UserRole } from '../../enums/user-role.enum';

export class Organization extends AuditableEntryBase {
  code: string;
  name: string;
  email: UserRole;
  userAllowedDomain!: string;
  isActive!: boolean;
}
