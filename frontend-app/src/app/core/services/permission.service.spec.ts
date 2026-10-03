import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { ModuleKey } from '../models/enums/module-key.enum';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { RoleDataService } from './data/role-data.service';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(PermissionService);

  it('denies every module while signed out', () => {
    for (const module of Object.values(ModuleKey)) {
      expect(service().levelFor(module)).toBe(PermissionLevel.NONE);
    }
    expect(service().allowedModules()).toHaveSize(0);
  });

  it('gives the admin full access to every module', async () => {
    await signInAs(UserRole.ADMIN);
    for (const module of Object.values(ModuleKey)) {
      expect(service().levelFor(module)).toBe(PermissionLevel.FULL);
    }
  });

  it('applies the manager rules', async () => {
    await signInAs(UserRole.MANAGER);
    expect(service().levelFor(ModuleKey.EMPLOYEES)).toBe(PermissionLevel.VIEW);
    expect(service().levelFor(ModuleKey.USERS)).toBe(PermissionLevel.NONE);
    expect(service().levelFor(ModuleKey.SETTINGS)).toBe(PermissionLevel.NONE);
    expect(service().levelFor(ModuleKey.SUPPLIERS)).toBe(PermissionLevel.FULL);
  });

  it('applies the pharmacist rules', async () => {
    await signInAs(UserRole.PHARMACIST);
    expect(service().levelFor(ModuleKey.DASHBOARD)).toBe(PermissionLevel.VIEW);
    expect(service().levelFor(ModuleKey.GRN)).toBe(PermissionLevel.FULL);
    expect(service().levelFor(ModuleKey.PURCHASE_ORDERS)).toBe(PermissionLevel.VIEW);
    expect(service().levelFor(ModuleKey.EMPLOYEES)).toBe(PermissionLevel.NONE);
  });

  it('applies the cashier rules and lands on products', async () => {
    await signInAs(UserRole.CASHIER);
    expect(service().levelFor(ModuleKey.DASHBOARD)).toBe(PermissionLevel.NONE);
    expect(service().levelFor(ModuleKey.PRODUCTS)).toBe(PermissionLevel.VIEW);
    expect(service().levelFor(ModuleKey.RELOAD_UTILITY)).toBe(PermissionLevel.FULL);
    expect(service().firstAllowedPath()).toBe('/products');
  });

  it('separates viewing from writing', async () => {
    await signInAs(UserRole.CASHIER);
    expect(service().canView(ModuleKey.PRODUCTS)).toBeTrue();
    expect(service().canWrite(ModuleKey.PRODUCTS)).toBeFalse();
    expect(service().canWrite(ModuleKey.RELOAD_UTILITY)).toBeTrue();
    expect(service().canView(ModuleKey.USERS)).toBeFalse();
  });

  it('updates without signing in again when the matrix changes', async () => {
    await signInAs(UserRole.CASHIER);
    expect(service().canView(ModuleKey.DASHBOARD)).toBeFalse();
    const roleDataService = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleDataService.getMatrix());
    await firstValueFrom(
      roleDataService.saveMatrix({
        ...matrix,
        CASHIER: { ...matrix.CASHIER, [ModuleKey.DASHBOARD]: PermissionLevel.VIEW },
      })
    );
    expect(service().canView(ModuleKey.DASHBOARD)).toBeTrue();
    expect(service().firstAllowedPath()).toBe('/dashboard');
  });

  it('denies everything when the matrix has not loaded', async () => {
    await signInAs(UserRole.ADMIN);
    TestBed.inject(PermissionService)['matrixSignal'].set(null);
    expect(service().canView(ModuleKey.DASHBOARD)).toBeFalse();
  });

  it('returns the requested address when the role allows it', async () => {
    await signInAs(UserRole.MANAGER);
    expect(service().landingPathFor('/suppliers')).toBe('/suppliers');
  });

  it('falls back to the first allowed module for blocked, unsafe or missing addresses', async () => {
    await signInAs(UserRole.CASHIER);
    expect(service().landingPathFor('/settings')).toBe('/products');
    expect(service().landingPathFor('https://evil.example')).toBe('/products');
    expect(service().landingPathFor('//evil.example')).toBe('/products');
    expect(service().landingPathFor(null)).toBe('/products');
  });

  it('points to access denied when no module is allowed', () => {
    expect(service().firstAllowedPath()).toBe('/access-denied');
  });
});
