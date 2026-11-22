import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { ModuleKey } from '../models/enums/module-key.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { moduleWriteGuard } from './module-write.guard';

describe('moduleWriteGuard', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const run = (module: unknown, viewOnlyRedirect?: string, params: Record<string, string> = {}) =>
    TestBed.runInInjectionContext(() =>
      moduleWriteGuard(
        { data: { module, viewOnlyRedirect }, params } as unknown as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );
  const serialize = (tree: unknown) => TestBed.inject(Router).serializeUrl(tree as UrlTree);

  it('allows a role with Full access to the module', async () => {
    await signInAs(UserRole.PHARMACIST);
    expect(run(ModuleKey.PRODUCTS)).toBeTrue();
  });

  it('sends a role with View access only to access denied', async () => {
    await signInAs(UserRole.CASHIER);
    expect(serialize(run(ModuleKey.PRODUCTS))).toBe('/access-denied');
  });

  it('denies a role with View access on another module', async () => {
    await signInAs(UserRole.PHARMACIST);
    expect(serialize(run(ModuleKey.PURCHASE_ORDERS))).toBe('/access-denied');
  });

  it('denies a missing or unknown module key', async () => {
    await signInAs(UserRole.ADMIN);
    expect(serialize(run(undefined))).toBe('/access-denied');
    expect(serialize(run('made-up'))).toBe('/access-denied');
  });

  it('denies a signed-out visitor', () => {
    expect(serialize(run(ModuleKey.PRODUCTS))).toBe('/access-denied');
  });

  describe('with a view-only redirect', () => {
    it('sends a View-only role to the redirect with the route id filled in', async () => {
      await signInAs(UserRole.MANAGER);
      expect(serialize(run(ModuleKey.EMPLOYEES, '/employees/:id', { id: 'emp-002' }))).toBe(
        '/employees/emp-002'
      );
      expect(serialize(run(ModuleKey.EMPLOYEES, '/employees'))).toBe('/employees');
    });

    it('encodes a hostile id instead of building a different path', async () => {
      await signInAs(UserRole.MANAGER);
      expect(serialize(run(ModuleKey.EMPLOYEES, '/employees/:id', { id: '../admin' }))).toBe(
        '/employees/..%2Fadmin'
      );
    });

    it('denies when the id is missing', async () => {
      await signInAs(UserRole.MANAGER);
      expect(serialize(run(ModuleKey.EMPLOYEES, '/employees/:id'))).toBe('/access-denied');
    });

    it('still sends a role with no access to access denied', async () => {
      await signInAs(UserRole.CASHIER);
      expect(serialize(run(ModuleKey.EMPLOYEES, '/employees/:id', { id: 'emp-002' }))).toBe(
        '/access-denied'
      );
    });

    it('lets an Admin through', async () => {
      await signInAs(UserRole.ADMIN);
      expect(run(ModuleKey.EMPLOYEES, '/employees/:id', { id: 'emp-002' })).toBeTrue();
    });
  });
});
