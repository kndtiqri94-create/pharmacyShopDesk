import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { moduleWriteGuard } from '../../../../core/guards/module-write.guard';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { LeaveDataService } from '../../../../core/services/data/leave-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { firstValueFrom, of } from 'rxjs';
import { EmployeeStatus } from '../../../../core/models/enums/employee-status.enum';
import { EmployeeDataService } from '../../../../core/services/data/employee-data.service';
import { EMPLOYEE_SEED } from '../../../../core/services/data/in-memory/seed/employee.seed';
import { LeaveApplicationComponent } from './leave-application.component';

describe('LeaveApplicationComponent', () => {
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

  async function render(role: UserRole = UserRole.ADMIN, prepare: () => void = () => undefined) {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
    await signInAs(role);
    prepare();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(LeaveApplicationComponent);
    fixture.detectChanges();
    await settle(fixture);
    return { fixture, element: fixture.nativeElement as HTMLElement, navigate };
  }

  const control = (element: HTMLElement, key: string) =>
    element.querySelector(`#leave-${key}`) as HTMLInputElement & HTMLSelectElement;
  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement | undefined;
  const dialogButton = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('app-confirm-dialog button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement;
  const notification = () => TestBed.inject(NotificationService).current();

  function set(fixture: Detectable, element: HTMLElement, key: string, value: string): void {
    const field = control(element, key);
    field.value = value;
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  }

  function fillValid(fixture: Detectable, element: HTMLElement): void {
    set(fixture, element, 'employeeId', 'emp-004');
    set(fixture, element, 'leaveTypeId', 'lt-003');
    set(fixture, element, 'reason', 'Personal');
    set(fixture, element, 'fromDate', '2026-08-03');
    set(fixture, element, 'toDate', '2026-08-04');
    set(fixture, element, 'approverEmployeeId', 'emp-002');
  }

  function balanceRow(element: HTMLElement, type: string): string[] {
    const row = Array.from(element.querySelectorAll('app-leave-balance-card tbody tr')).find(item =>
      item.textContent?.includes(type)
    )!;
    return Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim() ?? '');
  }

  it('shows the fields with required markers and labels tied to their controls', async () => {
    const { element } = await render();
    for (const key of [
      'employeeId',
      'year',
      'leaveTypeId',
      'reason',
      'fromDate',
      'toDate',
      'approverEmployeeId',
    ]) {
      expect(element.querySelector(`label[for="leave-${key}"]`)?.textContent).toContain('*');
      expect(control(element, key)).not.toBeNull();
    }
    for (const key of ['comments', 'coveringEmployeeId', 'attachment']) {
      expect(control(element, key)).not.toBeNull();
    }
    expect(element.querySelector('label[for="leave-comments"]')?.textContent).not.toContain('*');
  });

  it('starts with no employee and the current leave year with its period text', async () => {
    const { element } = await render();
    expect(control(element, 'employeeId').value).toBe('');
    expect(control(element, 'year').value).toBe('2026');
    expect(Array.from(control(element, 'year').options).map(o => o.value)).toEqual([
      '2025',
      '2026',
      '2027',
    ]);
    expect(element.textContent).toContain('01/01/2026 to 31/12/2026');
  });

  it('lists only active employees and only eligible approvers', async () => {
    const { fixture, element } = await render();
    const employees = Array.from(control(element, 'employeeId').options).map(o => o.textContent);
    expect(employees.join()).not.toContain('Sanduni');
    expect(employees.join()).toContain('EMP-004 - Ruwani Jayawardena');
    set(fixture, element, 'employeeId', 'emp-002');
    const approvers = Array.from(control(element, 'approverEmployeeId').options).map(o =>
      o.textContent?.trim()
    );
    expect(approvers.join()).toContain('EMP-001 - Nimal Perera');
    expect(approvers.join()).not.toContain('Kamal Silva');
    expect(approvers.join()).not.toContain('Dilani');
  });

  const daysText = (element: HTMLElement) =>
    element
      .querySelector('[data-testid="days-requested"]')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();

  it('shows the number of days live, with two decimals, before Apply', async () => {
    const { fixture, element } = await render();
    expect(daysText(element)).toBe('Days requested: choose a From and To date.');
    set(fixture, element, 'fromDate', '2026-08-03');
    expect(daysText(element)).toBe('Days requested: choose a From and To date.');
    set(fixture, element, 'toDate', '2026-08-03');
    expect(daysText(element)).toBe('Days requested: 1.00 days');
    set(fixture, element, 'toDate', '2026-08-05');
    expect(daysText(element)).toBe('Days requested: 3.00 days');
    set(fixture, element, 'fromDate', '2026-08-10');
    expect(daysText(element)).toBe('Days requested: choose a From and To date.');
  });

  it('shows a clear empty message instead of the form when there are no leave types', async () => {
    const { element } = await render(UserRole.ADMIN, () =>
      spyOn(TestBed.inject(LeaveDataService), 'getTypes').and.returnValue(of([]))
    );
    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('app-empty-state')?.textContent).toContain(
      'no leave types set up yet'
    );
    expect(buttonByText(element, 'Apply')).toBeUndefined();
  });

  it('shows a clear empty message instead of the form when there are no active employees', async () => {
    const { element } = await render(UserRole.ADMIN, () =>
      spyOn(TestBed.inject(EmployeeDataService), 'getAll').and.returnValue(of([]))
    );
    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('app-empty-state')?.textContent).toContain(
      'no active employees to choose'
    );
  });

  it('treats employees that are all Inactive as no one to choose', async () => {
    const inactive = EMPLOYEE_SEED.map(item => ({ ...item, status: EmployeeStatus.INACTIVE }));
    const { element } = await render(UserRole.ADMIN, () =>
      spyOn(TestBed.inject(EmployeeDataService), 'getAll').and.returnValue(of(inactive))
    );
    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('app-empty-state')).not.toBeNull();
  });

  it('names both gaps when there are neither employees nor leave types', async () => {
    const { element } = await render(UserRole.ADMIN, () => {
      spyOn(TestBed.inject(EmployeeDataService), 'getAll').and.returnValue(of([]));
      spyOn(TestBed.inject(LeaveDataService), 'getTypes').and.returnValue(of([]));
    });
    expect(element.querySelector('app-empty-state')?.textContent).toContain(
      'no active employees and no leave types'
    );
  });

  it('has Apply as the only primary button, plus Reset', async () => {
    const { element } = await render();
    const primaries = Array.from(element.querySelectorAll('button[data-variant="primary"]')).filter(
      button => button.closest('app-confirm-dialog') === null
    );
    expect(primaries).toHaveSize(1);
    expect(primaries[0].textContent?.trim()).toBe('Apply');
    expect(buttonByText(element, 'Reset')).toBeDefined();
  });

  it('prompts to choose an employee before showing the balance', async () => {
    const { fixture, element } = await render();
    expect(element.querySelector('app-leave-balance-card')?.textContent).toContain(
      'Choose an employee first'
    );
    expect(element.querySelector('app-leave-balance-card table')).toBeNull();
    set(fixture, element, 'employeeId', 'emp-004');
    expect(balanceRow(element, 'Casual Leave')).toEqual([
      'Casual Leave',
      '7.00',
      '5.00',
      '2.00',
      '0.00',
    ]);
  });

  it('follows the chosen year in the balance and period text', async () => {
    const { fixture, element } = await render();
    set(fixture, element, 'employeeId', 'emp-004');
    set(fixture, element, 'year', '2025');
    expect(element.textContent).toContain('01/01/2025 to 31/12/2025');
    expect(balanceRow(element, 'Christmas Day')).toEqual([
      'Christmas Day',
      '1.00',
      '0.00',
      '1.00',
      '0.00',
    ]);
  });

  it('lists a zero-balance leave type but does not let it be chosen', async () => {
    const { fixture, element } = await render();
    set(fixture, element, 'employeeId', 'emp-004');
    set(fixture, element, 'year', '2025');
    const christmas = Array.from(control(element, 'leaveTypeId').options).find(option =>
      option.textContent?.includes('Christmas Day')
    )!;
    expect(christmas.disabled).toBeTrue();
    expect(christmas.textContent).toContain('no balance');
  });

  it('shows errors on Apply with an empty form and focuses the first problem', async () => {
    const { fixture, element } = await render();
    buttonByText(element, 'Apply')!.click();
    await settle(fixture);
    expect(element.querySelector('#leave-employeeId-error')?.textContent).toContain(
      'Employee is required'
    );
    expect(element.querySelector('#leave-leaveTypeId-error')).not.toBeNull();
    expect(element.querySelector('#leave-fromDate-error')).not.toBeNull();
    expect(element.querySelector('#leave-reason-error')).not.toBeNull();
    expect(element.querySelector('#leave-approverEmployeeId-error')).not.toBeNull();
    expect(document.activeElement).toBe(control(element, 'employeeId'));
  });

  it('clears a field error as soon as the field changes', async () => {
    const { fixture, element } = await render();
    buttonByText(element, 'Apply')!.click();
    await settle(fixture);
    set(fixture, element, 'reason', 'Medical');
    expect(element.querySelector('#leave-reason-error')).toBeNull();
  });

  it('rejects a To date before the From date', async () => {
    const { fixture, element } = await render();
    fillValid(fixture, element);
    set(fixture, element, 'toDate', '2026-08-01');
    buttonByText(element, 'Apply')!.click();
    await settle(fixture);
    expect(element.querySelector('#leave-toDate-error')?.textContent).toContain('cannot be before');
    expect(document.activeElement).toBe(control(element, 'toDate'));
  });

  it('shows how many days are left when the request is too long', async () => {
    const { fixture, element } = await render();
    fillValid(fixture, element);
    set(fixture, element, 'toDate', '2026-08-12');
    buttonByText(element, 'Apply')!.click();
    await settle(fixture);
    expect(element.querySelector('#leave-toDate-error')?.textContent).toContain(
      'Only 5.00 days of Casual Leave left'
    );
  });

  it('warns when the covering employee is on approved leave on those dates', async () => {
    const { fixture, element } = await render();
    set(fixture, element, 'employeeId', 'emp-004');
    set(fixture, element, 'fromDate', '2026-09-22');
    set(fixture, element, 'toDate', '2026-09-23');
    expect(element.querySelector('app-alert')).toBeNull();
    set(fixture, element, 'coveringEmployeeId', 'emp-007');
    expect(element.querySelector('app-alert')?.textContent).toContain(
      'Anura Bandara is on approved leave'
    );
  });

  it('applies, keeps Employee and Year, clears the rest and refreshes the balance', async () => {
    const { fixture, element } = await render();
    fillValid(fixture, element);
    set(fixture, element, 'comments', 'private note');
    buttonByText(element, 'Apply')!.click();
    await settle(fixture);
    expect(notification()?.tone).toBe('success');
    expect(notification()?.message).toContain('Ruwani Jayawardena');
    expect(notification()?.message).not.toContain('Personal');
    expect(notification()?.message).not.toContain('private note');
    expect(control(element, 'employeeId').value).toBe('emp-004');
    expect(control(element, 'year').value).toBe('2026');
    expect(control(element, 'leaveTypeId').value).toBe('');
    expect(control(element, 'reason').value).toBe('');
    expect(control(element, 'fromDate').value).toBe('');
    expect(control(element, 'comments').value).toBe('');
    expect(control(element, 'approverEmployeeId').value).toBe('');
    expect(balanceRow(element, 'Casual Leave')).toEqual([
      'Casual Leave',
      '7.00',
      '3.00',
      '2.00',
      '2.00',
    ]);
    const saved = await firstValueFrom(TestBed.inject(LeaveDataService).getRequests());
    expect(
      saved.filter(item => item.employeeId === 'emp-004' && item.status === 'PENDING')
    ).toHaveSize(1);
  });

  it('refuses an overlapping request and saves nothing', async () => {
    const { fixture, element } = await render();
    fillValid(fixture, element);
    set(fixture, element, 'fromDate', '2026-05-05');
    set(fixture, element, 'toDate', '2026-05-06');
    buttonByText(element, 'Apply')!.click();
    await settle(fixture);
    expect(element.querySelector('#leave-fromDate-error')?.textContent).toContain('Overlaps');
    expect(notification()).toBeNull();
  });

  it('asks before Reset when the form has changes, and clears on confirm', async () => {
    const { fixture, element } = await render();
    fillValid(fixture, element);
    buttonByText(element, 'Reset')!.click();
    fixture.detectChanges();
    const dialog = element.querySelector('app-confirm-dialog')!;
    expect(dialog.textContent).toContain('Clear the form?');
    expect(control(element, 'reason').value).toBe('Personal');
    dialogButton(element, 'Clear form').click();
    fixture.detectChanges();
    expect(control(element, 'reason').value).toBe('');
    expect(control(element, 'employeeId').value).toBe('');
  });

  it('keeps what was typed when Reset is not confirmed', async () => {
    const { fixture, element } = await render();
    fillValid(fixture, element);
    buttonByText(element, 'Reset')!.click();
    fixture.detectChanges();
    dialogButton(element, 'Keep what I typed').click();
    fixture.detectChanges();
    expect(control(element, 'reason').value).toBe('Personal');
  });

  it('leaves straight away when nothing changed', async () => {
    const { element, navigate } = await render();
    buttonByText(element, 'Back to leave')!.click();
    expect(navigate).toHaveBeenCalledWith(['/employees']);
  });

  it('asks before leaving with unsaved changes', async () => {
    const { fixture, element, navigate } = await render();
    set(fixture, element, 'comments', 'draft');
    buttonByText(element, 'Back to leave')!.click();
    fixture.detectChanges();
    expect(navigate).not.toHaveBeenCalled();
    expect(element.querySelector('app-confirm-dialog')?.textContent).toContain(
      'Leave without applying?'
    );
    dialogButton(element, 'Leave without applying').click();
    expect(navigate).toHaveBeenCalledWith(['/employees']);
  });

  it('shows the covering employee search and filters by code or name, Active only, no applicant', async () => {
    const { fixture, element } = await render();
    set(fixture, element, 'employeeId', 'emp-004');
    buttonByText(element, 'Search employees')!.click();
    fixture.detectChanges();
    const options = () =>
      Array.from(control(element, 'coveringEmployeeId').options).map(o => o.textContent?.trim());
    expect(options().join()).not.toContain('Ruwani');
    expect(options().join()).not.toContain('Sanduni');
    set(fixture, element, 'coveringSearch', 'emp-005');
    expect(options()).toEqual(['No covering employee', 'EMP-005 - Suresh Kumar']);
    set(fixture, element, 'coveringSearch', 'silva');
    expect(options().join()).toContain('Kamal Silva');
    expect(options().join()).toContain('Tharindu Silva');
    expect(options().join()).not.toContain('Suresh');
  });

  it('accepts a PDF attachment by name only and rejects other types', async () => {
    const { fixture, element } = await render();
    const input = control(element, 'attachment');
    const choose = (file: File) => {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    choose(new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(element.querySelector('#leave-attachment-error')?.textContent).toContain(
      'PDF, JPG or PNG'
    );
    choose(new File(['x'], 'note.pdf', { type: 'application/pdf' }));
    expect(element.querySelector('app-leave-attachment-field')?.textContent).toContain('note.pdf');
    expect(element.querySelector('#leave-attachment-error')).toBeNull();
  });

  describe('permission matrix', () => {
    const serialize = (tree: unknown) => TestBed.inject(Router).serializeUrl(tree as UrlTree);
    const runGuard = () =>
      TestBed.runInInjectionContext(() =>
        moduleWriteGuard(
          {
            data: { module: ModuleKey.EMPLOYEES, viewOnlyRedirect: '/employees' },
            params: {},
          } as unknown as ActivatedRouteSnapshot,
          {} as RouterStateSnapshot
        )
      );

    it('lets Admin open the page', async () => {
      TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
      await signInAs(UserRole.ADMIN);
      expect(runGuard()).toBeTrue();
    });

    it('redirects a View-only Manager to /employees', async () => {
      TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
      await signInAs(UserRole.MANAGER);
      expect(serialize(runGuard())).toBe('/employees');
    });

    it('sends Pharmacist and Cashier to access denied', async () => {
      for (const role of [UserRole.PHARMACIST, UserRole.CASHIER]) {
        TestBed.resetTestingModule();
        clearBrowserStorage();
        TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
        await signInAs(role);
        expect(serialize(runGuard())).toBe('/access-denied');
      }
    });

    it('also leaves the page when a View-only Manager opens the component directly', async () => {
      const { element, navigate } = await render(UserRole.MANAGER);
      expect(navigate).toHaveBeenCalledWith(['/employees']);
      expect(element.querySelector('form')).toBeNull();
    });
  });
});
