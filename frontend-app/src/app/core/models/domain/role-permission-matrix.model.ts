import { ModuleKey } from '../enums/module-key.enum';
import { PermissionLevel } from '../enums/permission-level.enum';
import { UserRole } from '../enums/user-role.enum';

export type RolePermissionMatrix = Readonly<
  Record<UserRole, Readonly<Record<ModuleKey, PermissionLevel>>>
>;
