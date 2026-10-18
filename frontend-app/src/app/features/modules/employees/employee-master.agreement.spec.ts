import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { EmployeeStatus } from '../../../core/models/enums/employee-status.enum';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import {
  EmployeeAdminService,
  EmployeeRemoval,
} from '../../../core/services/employee-admin.service';
import { EMPLOYEE_SEED } from '../../../core/services/data/in-memory/seed/employee.seed';
import { NotificationService } from '../../../core/services/notification.service';
import { emptyEmployeeDraft, toDraft } from '../../../core/utils/employee-diff.util';
import { EmployeeFormInput } from '../../../core/utils/employee-validation.util';
import { UsersComponent } from '../users/users.component';
import { EmployeesComponent } from './employees.component';

describe('Employee master: the same people everywhere', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  const newEmployee = (): EmployeeFormInput => ({
    ...emptyEmployeeDraft('Main Pharmacy'),
    title: 'Mr.',
    code: 'EMP-050',
    firstName: 'Kasun',
    middleName: 'B',
    lastName: 'Silva',
    mobile: '771234567',
  });
  const seedDraft = (id: string) => toDraft(EMPLOYEE_SEED.find(item => item.id === id)!);
  const service = () => TestBed.inject(EmployeeAdminService);

  async function start(): Promise<void> {
    const params = convertToParamMap({});
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: params }, queryParamMap: of(params) },
        },
      ],
    });
    await signInAs(UserRole.ADMIN);
  }

  async function show<T>(component: Type<T>, tab?: string) {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    if (tab !== undefined) {
      const tabButton = Array.from(element.querySelectorAll('[role="tab"]')).find(item =>
        item.textContent?.trim().startsWith(tab)
      ) as HTMLButtonElement;
      tabButton.click();
      fixture.detectChanges();
    }
    return element;
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const listRows = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('app-employee-list tbody tr')).map(text);
  const attendanceRows = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('app-attendance-table tbody tr')).map(text);
  const tile = (element: HTMLElement, label: string) =>
    text(
      Array.from(element.querySelectorAll('app-stat-card')).find(item =>
        item.textContent?.includes(label)
      )
    );
  const leaveCount = (element: HTMLElement) =>
    text(
      Array.from(element.querySelectorAll('[role="tab"]')).find(item =>
        item.textContent?.includes('Leave')
      )
    );
  const pickerValues = async () => {
    const element = await show(UsersComponent);
    const select = element.querySelector('#add-user-employeeId') as HTMLSelectElement;
    return Array.from(select.options)
      .map(option => option.value)
      .filter(value => value !== '');
  };

  it('shows a new employee at the top of the list and in the stat card, Attendance tab and Add user picker (AC-6, AC-59, AC-60)', async () => {
    await start();
    const created = await service().create(newEmployee());
    expect(created.ok).toBeTrue();
    const id = created.ok ? created.employee.id : '';

    const staff = await show(EmployeesComponent);
    expect(listRows(staff)).toHaveSize(9);
    expect(listRows(staff)[0]).toContain('EMP-050');
    expect(listRows(staff)[0]).toContain('Kasun B Silva');
    expect(staff.querySelector('app-page-header')?.textContent).toContain('9 staff');
    expect(tile(staff, 'Total staff')).toContain('9');

    const attendance = await show(EmployeesComponent, 'Attendance');
    expect(attendanceRows(attendance).some(row => row.includes('Kasun B Silva'))).toBeTrue();
    expect(await pickerValues()).toContain(id);
  });

  it('changes the name everywhere after an edit (AC-6, AC-59)', async () => {
    await start();
    const edited = await service().update('emp-005', {
      ...seedDraft('emp-005'),
      firstName: 'Suri',
    });
    expect(edited.ok).toBeTrue();

    const staff = await show(EmployeesComponent);
    expect(listRows(staff).filter(row => row.includes('EMP-005'))[0]).toContain('Suri');
    const attendance = await show(EmployeesComponent, 'Attendance');
    expect(attendanceRows(attendance).filter(row => row.includes('Suri'))).toHaveSize(1);
    const picker = await show(UsersComponent);
    expect(text(picker.querySelector('#add-user-employeeId'))).toContain('Suri');
  });

  it('keeps an Inactive employee in the list but drops them from Attendance and the Add user picker (AC-8, AC-60)', async () => {
    await start();
    const result = await service().update('emp-006', {
      ...seedDraft('emp-006'),
      status: EmployeeStatus.INACTIVE,
    });
    expect(result.ok).toBeTrue();

    const staff = await show(EmployeesComponent);
    expect(listRows(staff)).toHaveSize(8);
    expect(listRows(staff).find(row => row.includes('EMP-006'))).toContain('Inactive');
    expect(tile(staff, 'Total staff')).toContain('8');
    const attendance = await show(EmployeesComponent, 'Attendance');
    expect(attendanceRows(attendance).some(row => row.includes('Tharindu'))).toBeFalse();
    expect(await pickerValues()).not.toContain('emp-006');
  });

  it('keeps an employee with a sign-in as Inactive instead of removing them, and removes one without (AC-6, AC-60)', async () => {
    await start();
    const kept = await service().remove('emp-004');
    expect(kept.ok && kept.outcome).toBe(EmployeeRemoval.DEACTIVATED);
    const removed = await service().remove('emp-007');
    expect(removed.ok && removed.outcome).toBe(EmployeeRemoval.REMOVED);

    const staff = await show(EmployeesComponent);
    expect(listRows(staff)).toHaveSize(7);
    expect(listRows(staff).find(row => row.includes('EMP-004'))).toContain('Inactive');
    expect(listRows(staff).some(row => row.includes('EMP-007'))).toBeFalse();
    expect(tile(staff, 'Total staff')).toContain('7');
    expect(tile(staff, 'On leave')).toContain('0');
    expect(leaveCount(staff)).toBe('Leave 0');
    const attendance = await show(EmployeesComponent, 'Attendance');
    expect(attendanceRows(attendance).some(row => row.includes('Ruwani'))).toBeFalse();
    expect(attendanceRows(attendance).some(row => row.includes('Anura'))).toBeFalse();
    expect(await pickerValues()).not.toContain('emp-007');
  });

  it('changes nothing in Employees tiles, Attendance or Users when only stored-only fields are edited (AC-5)', async () => {
    await start();
    const snapshot = async () => {
      const staff = await show(EmployeesComponent);
      const attendance = await show(EmployeesComponent, 'Attendance');
      const users = await show(UsersComponent);
      return {
        tiles: Array.from(staff.querySelectorAll('app-stat-card')).map(text),
        subtitle: text(staff.querySelector('app-page-header')),
        attendance: attendanceRows(attendance),
        userRows: Array.from(users.querySelectorAll('app-users-card tbody tr')).map(text),
        picker: await pickerValues(),
      };
    };
    const before = await snapshot();
    const result = await service().update('emp-002', {
      ...seedDraft('emp-002'),
      commissionRate: '12.5',
      productDiscountRate: '7',
      invoiceDiscountRate: '3',
      monthlyTarget: '250000',
      considerAsCustomer: true,
    });
    expect(result.ok).toBeTrue();
    expect(await snapshot()).toEqual(before);
  });

  it('forgets every change after a refresh (AC-7)', async () => {
    await start();
    expect((await service().create(newEmployee())).ok).toBeTrue();
    expect(listRows(await show(EmployeesComponent))).toHaveSize(9);

    TestBed.resetTestingModule();
    clearBrowserStorage();
    await start();
    const staff = await show(EmployeesComponent);
    expect(listRows(staff)).toHaveSize(8);
    expect(listRows(staff).some(row => row.includes('EMP-050'))).toBeFalse();
  });
});
