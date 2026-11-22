import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Route,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { PermissionLevel } from '../../../core/models/enums/permission-level.enum';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { RoleDataService } from '../../../core/services/data/role-data.service';
import { EMPLOYEES_ROUTES } from './employees.routes';

describe('EMPLOYEES_ROUTES payroll', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const payrollRoute = () => EMPLOYEES_ROUTES.find(route => route.path === 'payroll') as Route;

  async function visit(role: UserRole): Promise<string> {
    await signInAs(role);
    const route = payrollRoute();
    const result = TestBed.runInInjectionContext(() =>
      (route.canActivate ?? []).map(guard =>
        (guard as (r: ActivatedRouteSnapshot, s: RouterStateSnapshot) => boolean | UrlTree)(
          { data: route.data } as unknown as ActivatedRouteSnapshot,
          { url: '/employees/payroll' } as RouterStateSnapshot
        )
      )
    );
    const outcome = result.find(value => value !== true);
    return outcome === undefined
      ? 'allowed'
      : TestBed.inject(Router).serializeUrl(outcome as UrlTree);
  }

  async function setPayroll(role: UserRole, level: PermissionLevel) {
    const roleData = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleData.getMatrix());
    await firstValueFrom(
      roleData.saveMatrix({ ...matrix, [role]: { ...matrix[role], [ModuleKey.PAYROLL]: level } })
    );
  }

  it('is declared before the :id route, titled and keyed to the payroll module', () => {
    const paths = EMPLOYEES_ROUTES.map(route => route.path);
    expect(paths.indexOf('payroll')).toBeGreaterThan(-1);
    expect(paths.indexOf('payroll')).toBeLessThan(paths.indexOf(':id'));
    expect(payrollRoute().title).toBe('Employees salaries');
    expect(payrollRoute().data?.['module']).toBe(ModuleKey.PAYROLL);
  });

  it('allows Admin and Manager (view)', async () => {
    expect(await visit(UserRole.ADMIN)).toBe('allowed');
    expect(await visit(UserRole.MANAGER)).toBe('allowed');
  });

  it('blocks Pharmacist and Cashier by address', async () => {
    expect(await visit(UserRole.PHARMACIST)).toBe('/access-denied');
    expect(await visit(UserRole.CASHIER)).toBe('/access-denied');
  });

  it('blocks a role with Employees access but no Payroll access', async () => {
    await signInAs(UserRole.MANAGER);
    await setPayroll(UserRole.MANAGER, PermissionLevel.NONE);
    expect(await visit(UserRole.MANAGER)).toBe('/access-denied');
  });

  it('allows a role whose Payroll access was granted in the matrix', async () => {
    await signInAs(UserRole.PHARMACIST);
    await setPayroll(UserRole.PHARMACIST, PermissionLevel.VIEW);
    expect(await visit(UserRole.PHARMACIST)).toBe('allowed');
  });

  it('sends a signed-out visitor to sign in', async () => {
    const route = payrollRoute();
    const tree = TestBed.runInInjectionContext(() =>
      (route.canActivate![0] as (r: ActivatedRouteSnapshot, s: RouterStateSnapshot) => UrlTree)(
        { data: route.data } as unknown as ActivatedRouteSnapshot,
        { url: '/employees/payroll' } as RouterStateSnapshot
      )
    );
    expect(TestBed.inject(Router).serializeUrl(tree)).toContain('/sign-in');
  });
});
