import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { RolePermissionMatrix } from '../models/domain/role-permission-matrix.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { setMatrixCell } from '../utils/permission-matrix.util';
import { RoleDataService } from './data/role-data.service';
import { ROLE_PERMISSION_SEED } from './data/in-memory/seed/role-permission.seed';
import { PermissionService } from './permission.service';
import { RoleAdminService } from './role-admin.service';

describe('RoleAdminService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(RoleAdminService);
  const saved = () => firstValueFrom(TestBed.inject(RoleDataService).getMatrix());

  it('saves the changed cells and applies them to the live permissions without signing in again', async () => {
    await signInAs(UserRole.ADMIN);
    const permissions = TestBed.inject(PermissionService);
    await permissions.load();
    const draft = setMatrixCell(ROLE_PERMISSION_SEED, UserRole.ADMIN, ModuleKey.USERS, 'FULL');
    const changed = setMatrixCell(draft, UserRole.MANAGER, ModuleKey.USERS, 'VIEW');
    const result = await service().saveMatrix(changed);
    expect(result.ok).toBeTrue();
    expect((await saved()).MANAGER.users).toBe('VIEW');
    expect(permissions.matrix()?.MANAGER.users).toBe('VIEW');
  });

  it('forces the Admin column to Full even when a crafted matrix says otherwise', async () => {
    await signInAs(UserRole.ADMIN);
    const crafted = {
      ...ROLE_PERMISSION_SEED,
      ADMIN: { ...ROLE_PERMISSION_SEED.ADMIN, users: 'NONE', settings: 'NONE' },
    } as RolePermissionMatrix;
    const result = await service().saveMatrix(crafted);
    expect(result.ok).toBeTrue();
    const matrix = await saved();
    expect(Object.values(matrix.ADMIN).every(level => level === 'FULL')).toBeTrue();
  });

  it('rejects an invalid cell and keeps the saved matrix', async () => {
    await signInAs(UserRole.ADMIN);
    const crafted = {
      ...ROLE_PERMISSION_SEED,
      CASHIER: { ...ROLE_PERMISSION_SEED.CASHIER, grn: 'EVERYTHING' },
    } as unknown as RolePermissionMatrix;
    expect(await service().saveMatrix(crafted)).toEqual({ ok: false, reason: 'invalid' });
    expect(await saved()).toEqual(ROLE_PERMISSION_SEED);
  });

  it('refuses anyone who is not an Admin, or nobody signed in', async () => {
    const changed = setMatrixCell(ROLE_PERMISSION_SEED, UserRole.CASHIER, ModuleKey.GRN, 'FULL');
    expect(await service().saveMatrix(changed)).toEqual({ ok: false, reason: 'denied' });
    await signInAs(UserRole.MANAGER);
    await TestBed.inject(PermissionService).load();
    expect(await service().saveMatrix(changed)).toEqual({ ok: false, reason: 'denied' });
    expect(await saved()).toEqual(ROLE_PERMISSION_SEED);
  });
});
