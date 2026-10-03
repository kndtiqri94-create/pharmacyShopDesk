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
import { UserRole } from '../models/enums/user-role.enum';
import { authGuard, authMatchGuard } from './auth.guard';

describe('auth guards', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const runActivate = (url: string) =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)
    );
  const runMatch = (paths: string[]) =>
    TestBed.runInInjectionContext(() =>
      authMatchGuard(
        {} as Route,
        paths.map(path => new UrlSegment(path, {})),
        {} as never
      )
    );

  it('redirects a signed-out visitor to sign in and remembers the address', () => {
    const result = runActivate('/products?page=2') as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe(
      '/sign-in?returnUrl=%2Fproducts%3Fpage%3D2'
    );
  });

  it('stops signed-out visitors before the area is matched or loaded', () => {
    const result = runMatch(['purchase-orders']) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe(
      '/sign-in?returnUrl=%2Fpurchase-orders'
    );
  });

  it('lets a signed-in user through', async () => {
    await signInAs(UserRole.CASHIER);
    expect(runActivate('/products')).toBeTrue();
    expect(runMatch(['products'])).toBeTrue();
  });
});
