import { AuditableEntityBase } from './auditable-entry-base.model';

export class Organization extends AuditableEntityBase {
  Code: string;
  Name: string;
  Email: string;
  UserAllowedDomain: string;
  IsActive: boolean | null;
}
