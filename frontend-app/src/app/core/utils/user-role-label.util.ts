import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { BadgeTone } from '../models/shared/badge-tone.model';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  PHARMACIST: 'Pharmacist',
  CASHIER: 'Cashier',
};

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  FULL: 'Full',
  VIEW: 'View',
  NONE: 'No access',
};

export const PERMISSION_LEVEL_TONES: Record<PermissionLevel, BadgeTone> = {
  FULL: 'success',
  VIEW: 'info',
  NONE: 'neutral',
};

export function formatUserRoleLabel(role: UserRole): string {
  return USER_ROLE_LABELS[role] ?? role;
}

export function formatSessionRoleLabel(role: UserRole): string {
  return role === UserRole.ADMIN ? 'Owner' : formatUserRoleLabel(role);
}
