import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { UserRole } from '../models/enums/user-role.enum';
import { landingGuard } from './landing.guard';
import { signInRedirectGuard } from './sign-in-redirect.guard';

describe('sign-in redirect and landing guards', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const run = (guard: typeof signInRedirectGuard) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

  it('shows the sign-in page to a signed-out visitor', () => {
    expect(run(signInRedirectGuard)).toBeTrue();
  });

  it('sends a signed-in user to the first module the role allows', async () => {
    await signInAs(UserRole.CASHIER);
    const tree = run(signInRedirectGuard) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(tree)).toBe('/products');
  });

  it('lands the admin on the dashboard', async () => {
    await signInAs(UserRole.ADMIN);
    const tree = run(landingGuard) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(tree)).toBe('/dashboard');
  });
});
