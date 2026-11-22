import { UserRole } from '../models/enums/user-role.enum';

const COST_VISIBLE_ROLES: readonly string[] = [UserRole.ADMIN, UserRole.MANAGER];

export function canSeeCostPrice(role: string | null | undefined): boolean {
  return role !== null && role !== undefined && COST_VISIBLE_ROLES.includes(role);
}
