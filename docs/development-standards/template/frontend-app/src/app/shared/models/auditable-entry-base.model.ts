export abstract class AuditableEntryBase {
  id?: number;
  isArchived?: boolean;
  createdAt?: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
  archivedAt?: Date;
  archivedBy?: string;
  dateLastUpdated?: Date;
  lastUpdatedBy?: string;
}
