import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../core/services/notification.service';
import { EMPLOYEE_SEED } from '../../../core/services/data/in-memory/seed/employee.seed';
import { PermissionService } from '../../../core/services/permission.service';
import { UsersComponent } from './users.component';

describe('UsersComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  interface Detectable {
    detectChanges(): void;
  }

  async function settle(fixture: Detectable): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

  function routeWith(query: Record<string, string>) {
    return {
      provide: ActivatedRoute,
      useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
    };
  }

  async function render(role: UserRole = UserRole.ADMIN, query: Record<string, string> = {}) {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, routeWith(query)] });
    await signInAs(role);
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    await settle(fixture);
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const userRows = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('app-users-card tbody tr'));
  const rowText = (row: Element) => row.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const button = (element: HTMLElement, label: string) =>
    element.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
  const buttonByText = (scope: ParentNode, text: string) =>
    Array.from(scope.querySelectorAll('button')).find(item => item.textContent?.trim() === text) as
      HTMLButtonElement | undefined;
  const dialogOf = (element: HTMLElement, host: string) =>
    element.querySelector(`${host} dialog`) as HTMLDialogElement;
  const notification = () => TestBed.inject(NotificationService).current();

  function type(fixture: Detectable, input: HTMLInputElement | HTMLSelectElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    fixture.detectChanges();
  }

  const field = (element: HTMLElement, key: string) =>
    element.querySelector(`#add-user-${key}`) as HTMLInputElement & HTMLSelectElement;

  it('shows the heading, the subtitle and one primary Add user button', async () => {
    const { element } = await render();
    expect(element.querySelector('h1')?.textContent).toBe('Users & roles');
    expect(element.querySelector('app-page-header')?.textContent).toContain(
      'Who can sign in to ShopDesk and what they can do.'
    );
    const primaries = Array.from(element.querySelectorAll('button[data-variant="primary"]')).filter(
      item => !item.closest('dialog')
    );
    expect(primaries).toHaveSize(1);
    expect(primaries[0].textContent?.trim()).toBe('Add user');
  });

  it('shows the Users card with the active count and a row per user', async () => {
    const { element } = await render();
    expect(element.querySelector('app-users-card h2')?.textContent).toBe('Users');
    expect(element.querySelector('app-users-card')?.textContent).toContain('4 active users');
    expect(userRows(element)).toHaveSize(4);
    const second = rowText(userRows(element)[1]);
    expect(second).toContain('Kamal Silva');
    expect(second).toContain('kamal · EMP-002');
    expect(second).toContain('Manager');
    expect(second).toContain('20 Sep 2026 · 17:05');
    expect(second).toContain('Active');
    expect(button(element, 'Edit Kamal Silva')).not.toBeNull();
    expect(button(element, 'Disable Kamal Silva')).not.toBeNull();
  });

  it('makes the lock action unavailable on your own row', async () => {
    const { element } = await render();
    const own = userRows(element)[0].querySelector('button[aria-label^="Disable"]');
    expect((own as HTMLButtonElement).disabled).toBeTrue();
    expect((button(element, 'Disable Kamal Silva') as HTMLButtonElement).disabled).toBeFalse();
  });

  describe('edit role', () => {
    it('opens the side panel with the user details and changes only the role', async () => {
      const { fixture, element } = await render();
      button(element, 'Edit Ruwani Jayawardena').click();
      fixture.detectChanges();
      const dialog = dialogOf(element, 'app-edit-user-panel');
      expect(dialog.open).toBeTrue();
      expect(dialog.textContent).toContain('Ruwani Jayawardena');
      expect(dialog.textContent).toContain('ruwani · EMP-004');
      const select = element.querySelector('#edit-user-role') as HTMLSelectElement;
      expect(select.value).toBe('CASHIER');
      type(fixture, select, 'PHARMACIST');
      buttonByText(dialog, 'Save changes')?.click();
      await settle(fixture);
      expect(dialogOf(element, 'app-edit-user-panel').open).toBeFalse();
      const row = rowText(userRows(element)[3]);
      expect(row).toContain('Pharmacist');
      expect(row).toContain('ruwani · EMP-004');
      expect(notification()?.message).toBe('Ruwani Jayawardena is now Pharmacist.');
    });

    it('does not let you change your own role', async () => {
      const { fixture, element } = await render();
      button(element, 'Edit Nimal Perera').click();
      fixture.detectChanges();
      const dialog = dialogOf(element, 'app-edit-user-panel');
      expect((element.querySelector('#edit-user-role') as HTMLSelectElement).disabled).toBeTrue();
      expect(buttonByText(dialog, 'Save changes')?.disabled).toBeTrue();
      expect(dialog.textContent).toContain('You cannot change your own role.');
    });

    it('closes without a change when cancelled', async () => {
      const { fixture, element } = await render();
      button(element, 'Edit Ruwani Jayawardena').click();
      fixture.detectChanges();
      type(fixture, element.querySelector('#edit-user-role') as HTMLSelectElement, 'MANAGER');
      buttonByText(dialogOf(element, 'app-edit-user-panel'), 'Cancel')?.click();
      fixture.detectChanges();
      expect(dialogOf(element, 'app-edit-user-panel').open).toBeFalse();
      expect(rowText(userRows(element)[3])).toContain('Cashier');
    });
  });

  describe('lock and unlock', () => {
    it('asks for confirmation in plain words, then disables and keeps the user listed', async () => {
      const { fixture, element } = await render();
      button(element, 'Disable Kamal Silva').click();
      fixture.detectChanges();
      const dialog = dialogOf(element, 'app-confirm-dialog');
      expect(dialog.open).toBeTrue();
      expect(dialog.textContent).toContain('Kamal Silva will not be able to sign in');
      expect(dialog.textContent).toContain('stays on record');
      expect(rowText(userRows(element)[1])).toContain('Active');
      buttonByText(dialog, 'Disable user')?.click();
      await settle(fixture);
      expect(userRows(element)).toHaveSize(4);
      expect(rowText(userRows(element)[1])).toContain('Disabled');
      expect(element.querySelector('app-users-card')?.textContent).toContain('3 active users');
      expect(notification()?.message).toContain('Kamal Silva can no longer sign in');
      expect(button(element, 'Enable Kamal Silva')).not.toBeNull();
    });

    it('does nothing when the confirmation is cancelled', async () => {
      const { fixture, element } = await render();
      button(element, 'Disable Kamal Silva').click();
      fixture.detectChanges();
      buttonByText(dialogOf(element, 'app-confirm-dialog'), 'Cancel')?.click();
      fixture.detectChanges();
      expect(dialogOf(element, 'app-confirm-dialog').open).toBeFalse();
      expect(rowText(userRows(element)[1])).toContain('Active');
    });

    it('turns a disabled user back on straight away', async () => {
      const { fixture, element } = await render();
      button(element, 'Disable Kamal Silva').click();
      fixture.detectChanges();
      buttonByText(dialogOf(element, 'app-confirm-dialog'), 'Disable user')?.click();
      await settle(fixture);
      button(element, 'Enable Kamal Silva').click();
      await settle(fixture);
      expect(rowText(userRows(element)[1])).toContain('Active');
      expect(notification()?.message).toBe('Kamal Silva can sign in again.');
    });
  });

  describe('add user', () => {
    async function openPanel() {
      const context = await render();
      buttonByText(context.element, 'Add user')?.click();
      context.fixture.detectChanges();
      return context;
    }

    const create = (element: HTMLElement) =>
      buttonByText(dialogOf(element, 'app-add-user-panel'), 'Create user') as HTMLButtonElement;

    it('has the required fields, hints, the option and Cancel and Create user', async () => {
      const { element } = await openPanel();
      const dialog = dialogOf(element, 'app-add-user-panel');
      expect(dialog.open).toBeTrue();
      const labels = Array.from(dialog.querySelectorAll('label.field__label')).map(label =>
        label.textContent?.replace(/\s+/g, ' ').trim()
      );
      expect(labels).toEqual([
        'Employee *',
        'Username or email *',
        'Role *',
        'Temporary password *',
        'Quick PIN for the till',
      ]);
      expect(dialog.textContent).toContain('Cashiers can sell and take reloads, nothing else.');
      expect(dialog.textContent).toContain('Used to unlock the POS screen.');
      expect(dialog.textContent).toContain('Change password at first sign-in');
      expect(buttonByText(dialog, 'Cancel')).toBeDefined();
      expect(
        create(element).closest('app-button')?.querySelector('button')?.getAttribute('data-variant')
      ).toBe('primary');
      expect(field(element, 'password').type).toBe('password');
      expect(field(element, 'pin').type).toBe('password');
      expect(document.activeElement).toBe(field(element, 'employeeId'));
    });

    it('offers only employees who do not have a sign-in, with name and ID', async () => {
      const { element } = await openPanel();
      const options = Array.from(field(element, 'employeeId').options).map(option =>
        option.textContent?.trim()
      );
      expect(options).toEqual([
        'Choose an employee',
        'Suresh Kumar (EMP-005)',
        'Tharindu Silva (EMP-006)',
        'Anura Bandara (EMP-007)',
      ]);
    });

    it('creates nothing and shows each problem with a red border, focusing the first', async () => {
      const { fixture, element } = await openPanel();
      create(element).click();
      await settle(fixture);
      expect(userRows(element)).toHaveSize(4);
      const messages = Array.from(element.querySelectorAll('app-add-user-panel .field__error')).map(
        error => error.textContent
      );
      expect(messages).toEqual([
        'Choose the employee this sign-in is for',
        'Enter a username or email',
        'Choose a role',
        'Enter a temporary password',
      ]);
      expect(element.querySelectorAll('app-add-user-panel .sd-field-box--error')).toHaveSize(4);
      expect(document.activeElement).toBe(field(element, 'employeeId'));
    });

    it('rejects a duplicate username, a short password and a PIN that is not 4 digits', async () => {
      const { fixture, element } = await openPanel();
      type(fixture, field(element, 'employeeId'), 'emp-005');
      type(fixture, field(element, 'username'), ' Kamal ');
      type(fixture, field(element, 'role'), 'CASHIER');
      type(fixture, field(element, 'password'), 'short');
      type(fixture, field(element, 'pin'), '123');
      create(element).click();
      await settle(fixture);
      const error = (key: string) =>
        field(element, key).closest('app-field')?.querySelector('.field__error')?.textContent;
      expect(error('username')).toBe('That username or email is already used. Choose another');
      expect(error('password')).toBe('The temporary password must be at least 8 characters');
      expect(error('pin')).toBe('The Quick PIN must be exactly 4 digits');
      expect(document.activeElement).toBe(field(element, 'username'));
      expect(userRows(element)).toHaveSize(4);
    });

    it('creates an Active user with No sign-in yet, clears the form and removes the employee from the list', async () => {
      const { fixture, element } = await openPanel();
      type(fixture, field(element, 'employeeId'), 'emp-005');
      type(fixture, field(element, 'username'), 'suresh');
      type(fixture, field(element, 'role'), 'CASHIER');
      type(fixture, field(element, 'password'), 'Welcome-1');
      type(fixture, field(element, 'pin'), '1234');
      create(element).click();
      await settle(fixture);
      expect(userRows(element)).toHaveSize(5);
      const added = rowText(userRows(element)[4]);
      expect(added).toContain('Suresh Kumar');
      expect(added).toContain('suresh · EMP-005');
      expect(added).toContain('Cashier');
      expect(added).toContain('No sign-in yet');
      expect(added).toContain('Active');
      expect(element.querySelector('app-users-card')?.textContent).toContain('5 active users');
      expect(notification()?.tone).toBe('success');
      expect(notification()?.message).toBe('Suresh Kumar can now sign in as Cashier.');
      expect(notification()?.message).not.toContain('Welcome-1');
      expect(dialogOf(element, 'app-add-user-panel').open).toBeFalse();
      expect(field(element, 'username').value).toBe('');
      expect(field(element, 'password').value).toBe('');
      expect(field(element, 'pin').value).toBe('');
      expect(Array.from(field(element, 'employeeId').options).map(o => o.value)).not.toContain(
        'emp-005'
      );
    });

    it('clears the form and creates nothing on Cancel', async () => {
      const { fixture, element } = await openPanel();
      type(fixture, field(element, 'username'), 'someone');
      type(fixture, field(element, 'password'), 'Welcome-1');
      buttonByText(dialogOf(element, 'app-add-user-panel'), 'Cancel')?.click();
      fixture.detectChanges();
      expect(dialogOf(element, 'app-add-user-panel').open).toBeFalse();
      expect(field(element, 'username').value).toBe('');
      expect(field(element, 'password').value).toBe('');
      expect(userRows(element)).toHaveSize(4);
    });
  });

  describe('employee preselected from the Employees form (AC-35)', () => {
    const panelOpen = (element: HTMLElement) => dialogOf(element, 'app-add-user-panel').open;

    it('opens Add user with a valid unlinked Active employee chosen', async () => {
      const { element } = await render(UserRole.ADMIN, { employeeId: 'emp-006' });
      expect(panelOpen(element)).toBeTrue();
      expect(field(element, 'employeeId').value).toBe('emp-006');
    });

    for (const value of ['', 'emp-999', 'emp-001', '<script>', 'EMP-006', ' emp-006']) {
      it(`ignores the invalid or already linked value "${value}"`, async () => {
        const { element } = await render(UserRole.ADMIN, { employeeId: value });
        expect(panelOpen(element)).toBeFalse();
        expect(field(element, 'employeeId').value).toBe('');
      });
    }

    it('ignores an Inactive employee', async () => {
      const inactive = EMPLOYEE_SEED.find(employee => employee.status === 'INACTIVE');
      expect(inactive).toBeDefined();
      const { element } = await render(UserRole.ADMIN, { employeeId: inactive?.id ?? '' });
      expect(panelOpen(element)).toBeFalse();
      expect(field(element, 'employeeId').value).toBe('');
    });

    it('does not open the panel for someone who cannot change users', async () => {
      const { element } = await render(UserRole.MANAGER, { employeeId: 'emp-006' });
      expect(element.querySelector('app-add-user-panel')).toBeNull();
    });
  });

  describe('role permissions', () => {
    const matrixRows = (element: HTMLElement) =>
      Array.from(element.querySelectorAll('app-role-permissions-card tbody tr')).map(row =>
        Array.from(row.querySelectorAll('th, td')).map(cell => cell.textContent?.trim())
      );

    it('shows every module against the four roles as words', async () => {
      const { element } = await render();
      const headers = Array.from(
        element.querySelectorAll('app-role-permissions-card thead th')
      ).map(cell => cell.textContent?.trim());
      expect(headers).toEqual(['Module', 'Admin', 'Manager', 'Pharmacist', 'Cashier']);
      const rows = matrixRows(element);
      expect(rows.map(row => row[0])).toEqual([
        'Dashboard',
        'Products',
        'GRN',
        'Purchase orders',
        'Suppliers',
        'Employees',
        'Reload & Utility',
        'Users',
        'Settings',
      ]);
      expect(rows[0]).toEqual(['Dashboard', 'Full', 'Full', 'View', 'No access']);
      expect(rows[4]).toEqual(['Suppliers', 'Full', 'Full', 'View', 'No access']);
      expect(rows[5]).toEqual(['Employees', 'Full', 'View', 'No access', 'No access']);
      expect(rows[7]).toEqual(['Users', 'Full', 'No access', 'No access', 'No access']);
    });

    it('opens Edit roles with the Admin column fixed at Full and Discard returns to the saved matrix', async () => {
      const { fixture, element } = await render();
      buttonByText(element, 'Edit roles')?.click();
      fixture.detectChanges();
      const dialog = dialogOf(element, 'app-edit-roles-panel');
      expect(dialog.open).toBeTrue();
      expect(dialog.querySelectorAll('[data-testid="admin-fixed"]')).toHaveSize(9);
      expect(dialog.querySelectorAll('select')).toHaveSize(27);
      const select = dialog.querySelector(
        'select[aria-label="Cashier access to Settings"]'
      ) as HTMLSelectElement;
      type(fixture, select, 'FULL');
      buttonByText(dialog, 'Discard')?.click();
      fixture.detectChanges();
      expect(dialogOf(element, 'app-edit-roles-panel').open).toBeFalse();
      expect(matrixRows(element)[8]).toEqual([
        'Settings',
        'Full',
        'No access',
        'No access',
        'No access',
      ]);
      expect(TestBed.inject(PermissionService).matrix()?.CASHIER.settings).toBe('NONE');
      buttonByText(element, 'Edit roles')?.click();
      fixture.detectChanges();
      expect(
        (
          dialogOf(element, 'app-edit-roles-panel').querySelector(
            'select[aria-label="Cashier access to Settings"]'
          ) as HTMLSelectElement
        ).value
      ).toBe('NONE');
    });

    it('saves changes, updates the card and applies them to the live permissions', async () => {
      const { fixture, element } = await render();
      buttonByText(element, 'Edit roles')?.click();
      fixture.detectChanges();
      const dialog = dialogOf(element, 'app-edit-roles-panel');
      type(
        fixture,
        dialog.querySelector(
          'select[aria-label="Pharmacist access to Employees"]'
        ) as HTMLSelectElement,
        'VIEW'
      );
      buttonByText(dialog, 'Save changes')?.click();
      await settle(fixture);
      expect(dialogOf(element, 'app-edit-roles-panel').open).toBeFalse();
      expect(matrixRows(element)[5]).toEqual(['Employees', 'Full', 'View', 'View', 'No access']);
      expect(TestBed.inject(PermissionService).matrix()?.PHARMACIST.employees).toBe('VIEW');
      expect(notification()?.message).toContain('Permissions saved');
    });
  });

  it('hides every change action from a signed-in person who can only view users', async () => {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, routeWith({})] });
    await signInAs(UserRole.ADMIN);
    spyOn(TestBed.inject(PermissionService), 'canWrite').and.returnValue(false);
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    expect(buttonByText(element, 'Add user')).toBeUndefined();
    expect(buttonByText(element, 'Edit roles')).toBeUndefined();
    expect(element.querySelector('button[aria-label^="Edit "]')).toBeNull();
    expect(element.querySelector('app-add-user-panel')).toBeNull();
  });
});
