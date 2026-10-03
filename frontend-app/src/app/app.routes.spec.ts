import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../testing/auth-test.util';
import { UserRole } from './core/models/enums/user-role.enum';
import { routes } from './app.routes';

describe('application routes', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter(routes)] });
  });

  afterEach(clearBrowserStorage);

  async function open(url: string) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return { harness, router: TestBed.inject(Router) };
  }

  it('sends a signed-out visitor from any address to sign in and keeps the address', async () => {
    const { router } = await open('/purchase-orders');
    expect(router.url).toBe('/sign-in?returnUrl=%2Fpurchase-orders');
  });

  it('sends a signed-out visitor to sign in even for an address that does not exist', async () => {
    const { router } = await open('/nothing/here');
    expect(router.url).toContain('/sign-in');
  });

  it('lands the admin on the dashboard from the root address', async () => {
    await signInAs(UserRole.ADMIN);
    const { router } = await open('/');
    expect(router.url).toBe('/dashboard');
  });

  it('lands the cashier on the first module they may open', async () => {
    await signInAs(UserRole.CASHIER);
    const { router } = await open('/');
    expect(router.url).toBe('/products');
  });

  it('opens every allowed module for the admin as its own address', async () => {
    await signInAs(UserRole.ADMIN);
    for (const path of [
      'dashboard',
      'products',
      'grn',
      'purchase-orders',
      'suppliers',
      'employees',
      'reload-utility',
      'users',
      'settings',
    ]) {
      const { router } = await open(`/${path}`);
      expect(router.url).toBe(`/${path}`);
    }
  });

  it('stops a role from opening a module it has no access to', async () => {
    await signInAs(UserRole.CASHIER);
    for (const path of [
      'dashboard',
      'grn',
      'purchase-orders',
      'suppliers',
      'employees',
      'users',
      'settings',
    ]) {
      const { router } = await open(`/${path}`);
      expect(router.url).withContext(path).toBe('/access-denied');
    }
  });

  it('shows page not found inside the frame for an unknown address when signed in', async () => {
    await signInAs(UserRole.MANAGER);
    const { harness, router } = await open('/made-up');
    expect(router.url).toBe('/made-up');
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Page not found');
  });

  it('sends a signed-in user away from the sign-in page', async () => {
    await signInAs(UserRole.PHARMACIST);
    const { router } = await open('/sign-in');
    expect(router.url).toBe('/dashboard');
  });
});
