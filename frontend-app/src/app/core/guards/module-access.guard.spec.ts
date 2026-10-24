import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Route,
  Router,
  RouterStateSnapshot,
  UrlSegment,
  UrlTree,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { ModuleKey } from '../models/enums/module-key.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { RoleDataService } from '../services/data/role-data.service';
import { PermissionService } from '../services/permission.service';
import { moduleAccessActivateGuard, moduleAccessGuard } from './module-access.guard';

describe('module access guards', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const runMatch = (module: unknown, path: string) =>
    TestBed.runInInjectionContext(() =>
      moduleAccessGuard({ data: { module } } as Route, [new UrlSegment(path, {})], {} as never)
    );
  const runActivate = (module: unknown, url: string) =>
    TestBed.runInInjectionContext(() =>
      moduleAccessActivateGuard(
        { data: { module } } as unknown as ActivatedRouteSnapshot,
        { url } as RouterStateSnapshot
      )
    );
  const serialize = (tree: unknown) => TestBed.inject(Router).serializeUrl(tree as UrlTree);

  it('sends a signed-out visitor to sign in, not to access denied', () => {
    expect(serialize(runMatch(ModuleKey.PRODUCTS, 'products'))).toBe(
      '/sign-in?returnUrl=%2Fproducts'
    );
  });

  it('allows Full and View access', async () => {
    await signInAs(UserRole.CASHIER);
    expect(runMatch(ModuleKey.RELOAD_UTILITY, 'reload-utility')).toBeTrue();
    expect(runMatch(ModuleKey.PRODUCTS, 'products')).toBeTrue();
    expect(runActivate(ModuleKey.PRODUCTS, '/products')).toBeTrue();
  });

  it('blocks a module the role has no access to with a redirect, before it loads', async () => {
    await signInAs(UserRole.CASHIER);
    expect(serialize(runMatch(ModuleKey.SETTINGS, 'settings'))).toBe('/access-denied');
    expect(serialize(runActivate(ModuleKey.SETTINGS, '/settings'))).toBe('/access-denied');
  });

  it('blocks every restricted module for every role', async () => {
    const restricted: [UserRole, ModuleKey[]][] = [
      [UserRole.MANAGER, [ModuleKey.USERS, ModuleKey.SETTINGS]],
      [UserRole.PHARMACIST, [ModuleKey.EMPLOYEES, ModuleKey.USERS, ModuleKey.SETTINGS]],
      [
        UserRole.CASHIER,
        [
          ModuleKey.DASHBOARD,
          ModuleKey.GRN,
          ModuleKey.PURCHASE_ORDERS,
          ModuleKey.SUPPLIERS,
          ModuleKey.EMPLOYEES,
          ModuleKey.USERS,
          ModuleKey.SETTINGS,
        ],
      ],
    ];
    for (const [role, modules] of restricted) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
      await signInAs(role);
      for (const module of modules) {
        expect(serialize(runMatch(module, module)))
          .withContext(`${role} ${module}`)
          .toBe('/access-denied');
      }
    }
  });

  it('denies a route with a missing or unknown module key', async () => {
    await signInAs(UserRole.ADMIN);
    expect(serialize(runMatch(undefined, 'x'))).toBe('/access-denied');
    expect(serialize(runMatch('made-up', 'x'))).toBe('/access-denied');
  });
});

describe('module access guards for POS', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const runMatch = (module: unknown, path: string) =>
    TestBed.runInInjectionContext(() =>
      moduleAccessGuard({ data: { module } } as Route, [new UrlSegment(path, {})], {} as never)
    );
  const runActivate = (module: unknown, url: string) =>
    TestBed.runInInjectionContext(() =>
      moduleAccessActivateGuard(
        { data: { module } } as unknown as ActivatedRouteSnapshot,
        { url } as RouterStateSnapshot
      )
    );
  const serialize = (tree: unknown) => TestBed.inject(Router).serializeUrl(tree as UrlTree);

  async function removePosFromCashier(): Promise<void> {
    await TestBed.inject(PermissionService).load();
    const roleDataService = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleDataService.getMatrix());
    await firstValueFrom(
      roleDataService.saveMatrix({ ...matrix, CASHIER: { ...matrix.CASHIER, pos: 'NONE' } })
    );
  }

  it('lets every default role open the till', async () => {
    for (const role of [UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST, UserRole.CASHIER]) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
      await signInAs(role);
      expect(runMatch(ModuleKey.POS, 'pos')).withContext(role).toBeTrue();
      expect(runActivate(ModuleKey.POS, '/pos')).withContext(role).toBeTrue();
    }
  });

  it('sends a signed-out visitor to sign in and keeps the till address', () => {
    expect(serialize(runMatch(ModuleKey.POS, 'pos'))).toBe('/sign-in?returnUrl=%2Fpos');
  });

  it('blocks the till for a role without POS access, before it loads, and remembers it was POS', async () => {
    await signInAs(UserRole.CASHIER);
    await removePosFromCashier();
    const permissionService = TestBed.inject(PermissionService);
    expect(serialize(runMatch(ModuleKey.POS, 'pos'))).toBe('/access-denied');
    expect(permissionService.deniedModule()).toBe(ModuleKey.POS);
    expect(serialize(runActivate(ModuleKey.POS, '/pos'))).toBe('/access-denied');
  });

  it('forgets the POS denial once another module is opened or denied', async () => {
    await signInAs(UserRole.CASHIER);
    await removePosFromCashier();
    const permissionService = TestBed.inject(PermissionService);
    runMatch(ModuleKey.POS, 'pos');
    expect(runMatch(ModuleKey.PRODUCTS, 'products')).toBeTrue();
    expect(permissionService.deniedModule()).toBeNull();
    runMatch(ModuleKey.POS, 'pos');
    runMatch(ModuleKey.SETTINGS, 'settings');
    expect(permissionService.deniedModule()).toBe(ModuleKey.SETTINGS);
  });
});
