import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../testing/auth-test.util';
import { ModuleKey } from './core/models/enums/module-key.enum';
import { UserRole } from './core/models/enums/user-role.enum';
import { RoleDataService } from './core/services/data/role-data.service';
import { PermissionService } from './core/services/permission.service';
import { setMatrixCell } from './core/utils/permission-matrix.util';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';

describe('application routes', () => {
  beforeEach(() => {
    sharedHarness = undefined;
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter(routes)] });
  });

  afterEach(clearBrowserStorage);

  let sharedHarness: RouterTestingHarness | undefined;

  async function open(url: string) {
    sharedHarness ??= await RouterTestingHarness.create();
    const harness = sharedHarness;
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

  it('stops a Cashier from reaching any stock-in address by typing it', async () => {
    await signInAs(UserRole.CASHIER);
    for (const url of [
      '/grn/new',
      '/grn/grn-001',
      '/purchase-orders/new',
      '/purchase-orders/po-004',
      '/purchase-orders/po-005/edit',
    ]) {
      const { router } = await open(url);
      expect(router.url).withContext(url).toBe('/access-denied');
    }
  });

  it('lets a Pharmacist read purchase orders and use GRN but not create or edit orders', async () => {
    await signInAs(UserRole.PHARMACIST);
    for (const url of ['/purchase-orders', '/purchase-orders/po-004', '/grn', '/grn/new']) {
      const { router } = await open(url);
      expect(router.url).withContext(url).toBe(url);
    }
    for (const url of ['/purchase-orders/new', '/purchase-orders/po-005/edit']) {
      const { router } = await open(url);
      expect(router.url).withContext(url).toBe('/access-denied');
    }
  });

  it('lets a Manager open the new and edit purchase order addresses', async () => {
    await signInAs(UserRole.MANAGER);
    for (const url of ['/purchase-orders/new', '/purchase-orders/po-005/edit', '/grn/new']) {
      const { router } = await open(url);
      expect(router.url).withContext(url).toBe(url);
    }
  });

  it('shows a plain not found message for an unknown GRN or purchase order id', async () => {
    await signInAs(UserRole.MANAGER);
    const grn = await open('/grn/grn-999');
    await new Promise(resolve => setTimeout(resolve, 30));
    grn.harness.detectChanges();
    expect((grn.harness.routeNativeElement as HTMLElement).textContent).toContain(
      'That GRN is not in your list'
    );
    const order = await open('/purchase-orders/po-999');
    await new Promise(resolve => setTimeout(resolve, 30));
    order.harness.detectChanges();
    expect((order.harness.routeNativeElement as HTMLElement).textContent).toContain(
      'That purchase order is not in your list'
    );
  });

  it('sends a signed-in user away from the sign-in page', async () => {
    await signInAs(UserRole.PHARMACIST);
    const { router } = await open('/sign-in');
    expect(router.url).toBe('/dashboard');
  });

  it('stops a Cashier from opening Suppliers, Employees or Users by typing the address', async () => {
    await signInAs(UserRole.CASHIER);
    for (const url of ['/suppliers', '/employees', '/users']) {
      const { router } = await open(url);
      expect(router.url).withContext(url).toBe('/access-denied');
    }
    expect(
      TestBed.inject(PermissionService)
        .allowedModules()
        .map(item => item.path)
    ).not.toContain('suppliers');
  });

  it('lets a Pharmacist open Suppliers but stops them at Employees and Users', async () => {
    await signInAs(UserRole.PHARMACIST);
    expect((await open('/suppliers')).router.url).toBe('/suppliers');
    for (const url of ['/employees', '/users']) {
      const { router } = await open(url);
      expect(router.url).withContext(url).toBe('/access-denied');
    }
  });

  it('lets a Manager open Suppliers and Employees but stops them at Users', async () => {
    await signInAs(UserRole.MANAGER);
    expect((await open('/suppliers')).router.url).toBe('/suppliers');
    expect((await open('/employees')).router.url).toBe('/employees');
    expect((await open('/users')).router.url).toBe('/access-denied');
  });

  it('applies a saved permission change to guards and the sidebar without signing in again', async () => {
    await signInAs(UserRole.CASHIER);
    const permissionService = TestBed.inject(PermissionService);
    expect((await open('/suppliers')).router.url).toBe('/access-denied');
    expect(permissionService.allowedModules().map(item => item.key)).not.toContain(
      ModuleKey.SUPPLIERS
    );
    const roleDataService = TestBed.inject(RoleDataService);
    const saved = await firstValueFrom(roleDataService.getMatrix());
    await firstValueFrom(
      roleDataService.saveMatrix(
        setMatrixCell(saved, UserRole.CASHIER, ModuleKey.SUPPLIERS, 'VIEW')
      )
    );
    expect(permissionService.allowedModules().map(item => item.key)).toContain(ModuleKey.SUPPLIERS);
    expect((await open('/suppliers')).router.url).toBe('/suppliers');
    await firstValueFrom(
      roleDataService.saveMatrix(
        setMatrixCell(
          await firstValueFrom(roleDataService.getMatrix()),
          UserRole.CASHIER,
          ModuleKey.PRODUCTS,
          'NONE'
        )
      )
    );
    expect(permissionService.allowedModules().map(item => item.key)).not.toContain(
      ModuleKey.PRODUCTS
    );
    expect((await open('/products')).router.url).toBe('/access-denied');
  });
});
