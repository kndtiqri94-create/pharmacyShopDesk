import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { RolePermissionMatrix } from '../../../../core/models/domain/role-permission-matrix.model';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { ROLE_PERMISSION_SEED } from '../../../../core/services/data/in-memory/seed/role-permission.seed';
import { EditRolesPanelComponent } from './edit-roles-panel.component';

describe('EditRolesPanelComponent', () => {
  beforeEach(() => clearBrowserStorage());
  afterEach(() => clearBrowserStorage());

  async function render(role: UserRole = UserRole.ADMIN) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(role);
    const fixture = TestBed.createComponent(EditRolesPanelComponent);
    fixture.componentRef.setInput('matrix', ROLE_PERMISSION_SEED);
    fixture.componentRef.setInput('open', true);
    const saved: RolePermissionMatrix[] = [];
    let discarded = 0;
    fixture.componentInstance.saved.subscribe(matrix => saved.push(matrix));
    fixture.componentInstance.discarded.subscribe(() => (discarded += 1));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const select = (role: string, module: string) =>
      element.querySelector(
        `select[aria-label="${role} access to ${module}"]`
      ) as HTMLSelectElement;
    const button = (text: string) =>
      Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === text
      ) as HTMLButtonElement;
    const choose = (target: HTMLSelectElement, value: string) => {
      target.value = value;
      target.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const settle = async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      fixture.detectChanges();
    };
    return { fixture, element, select, button, choose, settle, saved, discarded: () => discarded };
  }

  it('offers a choice only for Manager, Pharmacist and Cashier and shows Admin as fixed Full', async () => {
    const { element, select } = await render();
    expect(element.querySelectorAll('select')).toHaveSize(33);
    expect(select('Admin', 'Users')).toBeNull();
    expect(element.querySelectorAll('[data-testid="admin-fixed"]')).toHaveSize(11);
    expect(select('Manager', 'Employees').value).toBe('VIEW');
    expect(select('Manager', 'Payroll').value).toBe('VIEW');
    expect(select('Cashier', 'Payroll').value).toBe('NONE');
    expect(
      Array.from(select('Manager', 'Employees').options).map(o => o.textContent?.trim())
    ).toEqual(['Full', 'View', 'No access']);
  });

  it('saves only valid choices and returns the saved matrix with Admin still Full', async () => {
    const { select, button, choose, settle, saved } = await render();
    choose(select('Cashier', 'GRN'), 'VIEW');
    button('Save changes').click();
    await settle();
    expect(saved).toHaveSize(1);
    expect(saved[0].CASHIER.grn).toBe('VIEW');
    expect(Object.values(saved[0].ADMIN).every(level => level === 'FULL')).toBeTrue();
  });

  it('ignores a crafted choice that is not Full, View or No access', async () => {
    const { select, button, settle, saved } = await render();
    const target = select('Cashier', 'GRN');
    const option = document.createElement('option');
    option.value = 'EVERYTHING';
    target.append(option);
    target.value = 'EVERYTHING';
    target.dispatchEvent(new Event('change'));
    button('Save changes').click();
    await settle();
    expect(saved[0].CASHIER.grn).toBe('NONE');
  });

  it('discards the unsaved choices', async () => {
    const { fixture, select, button, choose, discarded } = await render();
    choose(select('Cashier', 'GRN'), 'FULL');
    button('Discard').click();
    fixture.detectChanges();
    expect(discarded()).toBe(1);
    expect(select('Cashier', 'GRN').value).toBe('NONE');
  });

  it('refuses to save for someone who cannot change users and says so', async () => {
    const { select, button, choose, settle, saved, element } = await render(UserRole.MANAGER);
    choose(select('Cashier', 'GRN'), 'FULL');
    button('Save changes').click();
    await settle();
    expect(saved).toEqual([]);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('do not have access');
  });
});
