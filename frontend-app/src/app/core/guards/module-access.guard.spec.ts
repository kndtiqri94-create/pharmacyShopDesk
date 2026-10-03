import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Route,
  Router,
  RouterStateSnapshot,
  UrlSegment,
  UrlTree,
} from '@angular/router';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { ModuleKey } from '../models/enums/module-key.enum';
import { UserRole } from '../models/enums/user-role.enum';
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
