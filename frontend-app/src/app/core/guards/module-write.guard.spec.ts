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

  const run = (module: unknown) =>
    TestBed.runInInjectionContext(() =>
      moduleWriteGuard(
        { data: { module } } as unknown as ActivatedRouteSnapshot,
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
});
