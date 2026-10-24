import { RolePermissionMatrix } from '../models/domain/role-permission-matrix.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { ALL_USER_ROLES, UserRole } from '../models/enums/user-role.enum';
import { ModuleDefinition } from '../models/domain/module-definition.model';
import { MODULE_DEFINITIONS, getModuleDefinition } from './module-definitions.util';

export const PERMISSION_LEVELS: readonly PermissionLevel[] = [
  PermissionLevel.FULL,
  PermissionLevel.VIEW,
  PermissionLevel.NONE,
];

export const EDITABLE_ROLES: readonly UserRole[] = ALL_USER_ROLES.filter(
  role => role !== UserRole.ADMIN
);

const MATRIX_ORDER: readonly ModuleKey[] = [
  ModuleKey.DASHBOARD,
  ModuleKey.PRODUCTS,
  ModuleKey.GRN,
  ModuleKey.PURCHASE_ORDERS,
  ModuleKey.SUPPLIERS,
  ModuleKey.EMPLOYEES,
  ModuleKey.PAYROLL,
  ModuleKey.RELOAD_UTILITY,
  ModuleKey.POS,
  ModuleKey.USERS,
  ModuleKey.SETTINGS,
];

const OPTIONAL_MODULES: readonly ModuleKey[] = [ModuleKey.PAYROLL, ModuleKey.POS];

export const MATRIX_MODULES: readonly ModuleDefinition[] = MATRIX_ORDER.map(getModuleDefinition);

export interface MatrixChange {
  role: UserRole;
  module: ModuleKey;
  from: PermissionLevel;
  to: PermissionLevel;
}

export type NormaliseMatrixResult = { ok: true; matrix: RolePermissionMatrix } | { ok: false };

export function isPermissionLevel(value: unknown): value is PermissionLevel {
  return PERMISSION_LEVELS.some(level => level === value);
}

export function normaliseMatrix(matrix: RolePermissionMatrix): NormaliseMatrixResult {
  const result = {} as Record<UserRole, Record<ModuleKey, PermissionLevel>>;
  for (const role of ALL_USER_ROLES) {
    const row = {} as Record<ModuleKey, PermissionLevel>;
    for (const definition of MODULE_DEFINITIONS) {
      const stored = matrix[role]?.[definition.key];
      const level =
        role === UserRole.ADMIN
          ? PermissionLevel.FULL
          : (stored ?? (OPTIONAL_MODULES.includes(definition.key) ? PermissionLevel.NONE : stored));
      if (!isPermissionLevel(level)) return { ok: false };
      row[definition.key] = level;
    }
    result[role] = row;
  }
  return { ok: true, matrix: result };
}

export function diffMatrix(
  saved: RolePermissionMatrix,
  draft: RolePermissionMatrix
): MatrixChange[] {
  return ALL_USER_ROLES.flatMap(role =>
    MODULE_DEFINITIONS.filter(
      definition => saved[role][definition.key] !== draft[role][definition.key]
    ).map(definition => ({
      role,
      module: definition.key,
      from: saved[role][definition.key],
      to: draft[role][definition.key],
    }))
  );
}

export function setMatrixCell(
  matrix: RolePermissionMatrix,
  role: UserRole,
  module: ModuleKey,
  level: PermissionLevel
): RolePermissionMatrix {
  if (role === UserRole.ADMIN || !isPermissionLevel(level)) return matrix;
  return { ...matrix, [role]: { ...matrix[role], [module]: level } };
}
