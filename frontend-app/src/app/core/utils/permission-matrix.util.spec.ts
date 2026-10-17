import { RolePermissionMatrix } from '../models/domain/role-permission-matrix.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { ROLE_PERMISSION_SEED } from '../services/data/in-memory/seed/role-permission.seed';
import {
  EDITABLE_ROLES,
  diffMatrix,
  normaliseMatrix,
  setMatrixCell,
} from './permission-matrix.util';

describe('permission-matrix.util', () => {
  it('returns a copy and keeps the saved sample unchanged', () => {
    const result = normaliseMatrix(ROLE_PERMISSION_SEED);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.matrix).toEqual(ROLE_PERMISSION_SEED);
    expect(result.matrix).not.toBe(ROLE_PERMISSION_SEED);
  });

  it('forces the Admin column to Full on every module', () => {
    const crafted = {
      ...ROLE_PERMISSION_SEED,
      ADMIN: { ...ROLE_PERMISSION_SEED.ADMIN, users: 'NONE', settings: 'VIEW' },
    } as RolePermissionMatrix;
    const result = normaliseMatrix(crafted);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(
      Object.values(result.matrix.ADMIN).every(level => level === PermissionLevel.FULL)
    ).toBeTrue();
  });

  it('rejects a cell that is not Full, View or No access', () => {
    const crafted = {
      ...ROLE_PERMISSION_SEED,
      MANAGER: { ...ROLE_PERMISSION_SEED.MANAGER, grn: 'EVERYTHING' },
    } as unknown as RolePermissionMatrix;
    expect(normaliseMatrix(crafted).ok).toBeFalse();
  });

  it('rejects a matrix with a missing role or module', () => {
    const missingRole = structuredClone(ROLE_PERMISSION_SEED) as unknown as Record<string, unknown>;
    delete missingRole['CASHIER'];
    expect(normaliseMatrix(missingRole as unknown as RolePermissionMatrix).ok).toBeFalse();
    const missingModule = structuredClone(ROLE_PERMISSION_SEED) as unknown as Record<
      string,
      Record<string, string>
    >;
    delete missingModule['MANAGER']['users'];
    expect(normaliseMatrix(missingModule as unknown as RolePermissionMatrix).ok).toBeFalse();
  });

  it('changes one cell without touching the original, and never the Admin column', () => {
    const changed = setMatrixCell(
      ROLE_PERMISSION_SEED,
      UserRole.CASHIER,
      ModuleKey.GRN,
      PermissionLevel.VIEW
    );
    expect(changed.CASHIER.grn).toBe('VIEW');
    expect(ROLE_PERMISSION_SEED.CASHIER.grn).toBe('NONE');
    const adminAttempt = setMatrixCell(
      ROLE_PERMISSION_SEED,
      UserRole.ADMIN,
      ModuleKey.USERS,
      PermissionLevel.NONE
    );
    expect(adminAttempt).toBe(ROLE_PERMISSION_SEED);
  });

  it('lists the changes between the saved and draft matrix', () => {
    const draft = setMatrixCell(
      ROLE_PERMISSION_SEED,
      UserRole.PHARMACIST,
      ModuleKey.EMPLOYEES,
      PermissionLevel.VIEW
    );
    expect(diffMatrix(ROLE_PERMISSION_SEED, ROLE_PERMISSION_SEED)).toEqual([]);
    expect(diffMatrix(ROLE_PERMISSION_SEED, draft)).toEqual([
      { role: 'PHARMACIST', module: 'employees', from: 'NONE', to: 'VIEW' },
    ]);
  });

  it('does not let Admin be edited', () => {
    expect(EDITABLE_ROLES).toEqual(['MANAGER', 'PHARMACIST', 'CASHIER']);
  });
});
