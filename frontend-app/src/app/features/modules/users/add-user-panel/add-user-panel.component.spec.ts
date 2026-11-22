import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { AppUser } from '../../../../core/models/domain/app-user.model';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { EMPLOYEE_SEED } from '../../../../core/services/data/in-memory/seed/employee.seed';
import { AddUserPanelComponent } from './add-user-panel.component';

describe('AddUserPanelComponent', () => {
  beforeEach(() => clearBrowserStorage());
  afterEach(() => clearBrowserStorage());

  async function render(role: UserRole = UserRole.ADMIN) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(role);
    const fixture = TestBed.createComponent(AddUserPanelComponent);
    fixture.componentRef.setInput(
      'employees',
      EMPLOYEE_SEED.filter(employee => employee.userId === null)
    );
    fixture.componentRef.setInput('open', true);
    const created: AppUser[] = [];
    let cancelled = 0;
    fixture.componentInstance.created.subscribe(user => created.push(user));
    fixture.componentInstance.cancelled.subscribe(() => (cancelled += 1));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const field = (key: string) =>
      element.querySelector(`#add-user-${key}`) as HTMLInputElement & HTMLSelectElement;
    const button = (text: string) =>
      Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === text
      ) as HTMLButtonElement;
    const fill = (key: string, value: string) => {
      const control = field(key);
      control.value = value;
      control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input'));
    };
    const settle = async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      fixture.detectChanges();
    };
    return { fixture, element, field, button, fill, settle, created, cancelled: () => cancelled };
  }

  it('hides what is typed in the password and PIN fields and does not autofill them', async () => {
    const { field } = await render();
    expect(field('password').type).toBe('password');
    expect(field('password').getAttribute('autocomplete')).toBe('new-password');
    expect(field('pin').type).toBe('password');
    expect(field('pin').getAttribute('autocomplete')).toBe('off');
    expect(field('pin').getAttribute('maxlength')).toBe('4');
  });

  it('marks required fields invalid for assistive tech and focuses the first problem', async () => {
    const { fixture, field, button, settle } = await render();
    button('Create user').click();
    await settle();
    fixture.detectChanges();
    expect(field('employeeId').getAttribute('aria-invalid')).toBe('true');
    expect(field('username').getAttribute('aria-describedby')).toBe('add-user-username-error');
    expect(document.activeElement).toBe(field('employeeId'));
  });

  it('creates the user, announces it, and clears every field including the password and PIN', async () => {
    const { fixture, field, button, fill, settle, created } = await render();
    fill('employeeId', 'emp-006');
    fill('username', 'tharindu');
    fill('role', 'PHARMACIST');
    fill('password', 'Welcome-1');
    fill('pin', '4321');
    button('Create user').click();
    await settle();
    expect(created).toHaveSize(1);
    expect(created[0].displayName).toBe('Tharindu Silva');
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(field('username').value).toBe('');
    expect(field('password').value).toBe('');
    expect(field('pin').value).toBe('');
  });

  it('refuses for someone who cannot change users', async () => {
    const { field, button, fill, settle, created } = await render(UserRole.MANAGER);
    fill('employeeId', 'emp-006');
    fill('username', 'tharindu');
    fill('role', 'PHARMACIST');
    fill('password', 'Welcome-1');
    button('Create user').click();
    await settle();
    expect(created).toEqual([]);
    expect(field('username').value).toBe('tharindu');
  });

  it('offers "Change password at first sign-in" as a toggle that is on by default and resets', async () => {
    const { fixture, element, fill, button } = await render();
    const toggle = () =>
      element.querySelector('app-toggle button[role="switch"]') as HTMLButtonElement;
    expect(element.querySelector('input[type="checkbox"]')).toBeNull();
    expect(element.querySelector('app-toggle')?.textContent).toContain(
      'Change password at first sign-in'
    );
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    toggle().click();
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    expect(fixture.componentInstance['form'].getRawValue().mustChangePassword).toBeFalse();
    fill('username', 'someone');
    button('Cancel').click();
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-checked')).toBe('true');
  });

  it('chooses the preselected employee when opened, and clears it on close', async () => {
    const { fixture, field } = await render();
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('preselectedEmployeeId', 'emp-006');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(field('employeeId').value).toBe('emp-006');
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(field('employeeId').value).toBe('');
  });

  it('ignores a preselected employee that is not in the offered list', async () => {
    const { fixture, field } = await render();
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('preselectedEmployeeId', 'emp-001');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(field('employeeId').value).toBe('');
  });

  it('clears the form and raises cancelled on Cancel', async () => {
    const { field, button, fill, cancelled } = await render();
    fill('username', 'someone');
    button('Cancel').click();
    expect(cancelled()).toBe(1);
    expect(field('username').value).toBe('');
  });
});
