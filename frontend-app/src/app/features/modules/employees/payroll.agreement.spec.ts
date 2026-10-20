import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { PermissionLevel } from '../../../core/models/enums/permission-level.enum';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { RoleDataService } from '../../../core/services/data/role-data.service';
import { EMPLOYEE_SEED } from '../../../core/services/data/in-memory/seed/employee.seed';
import { EmployeeAdminService } from '../../../core/services/employee-admin.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PayrollAdminService } from '../../../core/services/payroll-admin.service';
import { PermissionService } from '../../../core/services/permission.service';
import { toDraft } from '../../../core/utils/employee-diff.util';
import { EmployeeFormInput } from '../../../core/utils/employee-validation.util';
import { EmployeesComponent } from './employees.component';
import { LeaveApplicationComponent } from './leave-application/leave-application.component';
import { PayrollComponent } from './payroll/payroll.component';

describe('Payroll: the same pay everywhere', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  const employees = () => TestBed.inject(EmployeeAdminService);
  const payroll = () => TestBed.inject(PayrollAdminService);
  const seedDraft = (id: string) => toDraft(EMPLOYEE_SEED.find(item => item.id === id)!);

  async function start(role: UserRole = UserRole.ADMIN): Promise<void> {
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
    await signInAs(role);
    await TestBed.inject(PermissionService).load();
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
    return { fixture, element };
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  const payRow = async (code: string, tab?: string): Promise<Record<string, string>> => {
    const { element } = await show(PayrollComponent, tab);
    const headers = Array.from(element.querySelectorAll('thead th')).map(item =>
      text(item).replace(/ \(Rs\.\)$/, '')
    );
    const row = Array.from(element.querySelectorAll('tbody tr')).find(item =>
      item.textContent?.includes(code)
    );
    const cells = Array.from(row?.querySelectorAll('td') ?? []).map(text);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
  };
  const money = (value: string | undefined) => Number((value ?? '').replace(/,/g, ''));

  const onLeaveTile = async () => {
    const { element } = await show(EmployeesComponent);
    const tile = Array.from(element.querySelectorAll('app-stat-card')).find(item =>
      item.textContent?.includes('On leave')
    );
    return Number(/On leave\s*(\d+)/.exec(text(tile))?.[1]);
  };

  const staffRow = async (code: string) => {
    const { element } = await show(EmployeesComponent);
    return text(
      Array.from(element.querySelectorAll('app-employee-list tbody tr')).find(item =>
        item.textContent?.includes(code)
      )
    );
  };

  const leaveTab = async () => {
    const { element } = await show(EmployeesComponent, 'Leave');
    const tab = Array.from(element.querySelectorAll('[role="tab"]')).find(item =>
      item.textContent?.includes('Leave')
    );
    return {
      count: text(tab),
      rows: Array.from(element.querySelectorAll('app-leave-requests tbody tr')).map(text),
    };
  };

  const casualBalance = async () => {
    const { fixture, element } = await show(LeaveApplicationComponent);
    const select = element.querySelector('#leave-employeeId') as HTMLSelectElement;
    select.value = 'emp-004';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const row = Array.from(element.querySelectorAll('app-leave-balance-card tbody tr')).find(item =>
      item.textContent?.includes('Casual Leave')
    )!;
    return Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim() ?? '');
  };

  const edit = async (id: string, patch: Partial<EmployeeFormInput>) => {
    const result = await employees().update(id, { ...seedDraft(id), ...patch });
    expect(result.ok).toBeTrue();
  };

  const grant = async (role: UserRole, levels: Partial<Record<ModuleKey, PermissionLevel>>) => {
    const roleData = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleData.getMatrix());
    await firstValueFrom(
      roleData.saveMatrix({ ...matrix, [role]: { ...matrix[role], ...levels } })
    );
    await TestBed.inject(PermissionService).load();
  };

  describe('Employee master changes recalculate the pay row (AC-15)', () => {
    it('follows a new basic salary through gross, EPF and net', async () => {
      await start();
      const before = await payRow('EMP-004');
      await edit('emp-004', { basicSalary: '80000' });
      const after = await payRow('EMP-004');
      expect(money(after['Basic Salary'])).toBe(80000);
      expect(money(after['Gross Salary'])).toBe(money(before['Gross Salary']) + 15000);
      expect(money(after['EPF Deductions'])).toBe(6400);
      expect(money(after['Net Salary'])).toBeGreaterThan(money(before['Net Salary']));
    });

    it('follows an added allowance in the allowance and gross columns', async () => {
      await start();
      const before = await payRow('EMP-004');
      expect(money(before['Allowance'])).toBe(0);
      await edit('emp-004', { allowances: [{ id: 'alw-new', name: 'Travel', amount: '2500' }] });
      const after = await payRow('EMP-004');
      expect(money(after['Allowance'])).toBe(2500);
      expect(money(after['Gross Salary'])).toBe(money(before['Gross Salary']) + 2500);
    });

    it('follows the Calculate EPF flag: Off shows N/A and the net rises by the EPF amount', async () => {
      await start();
      const before = await payRow('EMP-004');
      expect(money(before['EPF Deductions'])).toBeGreaterThan(0);
      await edit('emp-004', { calculateEpf: false });
      const after = await payRow('EMP-004');
      expect(after['EPF Deductions']).toBe('N/A');
      expect(money(after['Net Salary'])).toBe(
        money(before['Net Salary']) + money(before['EPF Deductions'])
      );
      expect(money(after['Gross Salary'])).toBe(money(before['Gross Salary']));
    });

    it('follows the Over Time Rate', async () => {
      await start();
      const before = await payRow('EMP-004');
      await edit('emp-004', { overTimeRate: '600' });
      const after = await payRow('EMP-004');
      expect(money(before['Over Time'])).toBe(1800);
      expect(money(after['Over Time'])).toBe(2700);
      expect(money(after['Gross Salary'])).toBe(money(before['Gross Salary']) + 900);
    });

    it('follows the Commission Rate on the sample commission base', async () => {
      await start();
      const before = await payRow('EMP-002');
      expect(money(before['Commission'])).toBeGreaterThan(0);
      await edit('emp-002', { commissionRate: '0' });
      const after = await payRow('EMP-002');
      expect(money(after['Commission'])).toBe(0);
      expect(money(after['Gross Salary'])).toBe(
        money(before['Gross Salary']) - money(before['Commission'])
      );
    });

    it('drops an employee made Inactive from the pay table', async () => {
      await start();
      await edit('emp-004', { status: 'INACTIVE' });
      expect((await payRow('EMP-004'))['Name']).toBeUndefined();
    });
  });

  describe('advances, nopay and quick leave recalculate the pay row', () => {
    it('adds a salary advance to the month and lowers the net', async () => {
      await start();
      const before = await payRow('EMP-004');
      const result = await payroll().addSalaryAdvance({
        employeeId: 'emp-004',
        counter: 'Counter1',
        date: '2026-09-21',
        amount: '1000',
      });
      expect(result.ok).toBeTrue();
      const after = await payRow('EMP-004');
      expect(money(after['Salary Advance'])).toBe(money(before['Salary Advance']) + 1000);
      expect(money(after['Net Salary'])).toBe(money(before['Net Salary']) - 1000);
      expect(after['Gross Salary']).toBe(before['Gross Salary']);
    });

    it('adds a nopay amount to the month and lowers the net', async () => {
      await start();
      const before = await payRow('EMP-004');
      const result = await payroll().addNopay({
        employeeId: 'emp-004',
        date: '2026-09-21',
        amount: '500',
        reason: 'Late arrival',
      });
      expect(result.ok).toBeTrue();
      const after = await payRow('EMP-004');
      expect(money(after['Total Nopay'])).toBe(money(before['Total Nopay']) + 500);
      expect(money(after['Net Salary'])).toBe(money(before['Net Salary']) - 500);
    });

    it('does not change any other employee or any other month', async () => {
      await start();
      const other = await payRow('EMP-002');
      const own = await payRow('EMP-004');
      await payroll().addNopay({
        employeeId: 'emp-004',
        date: '2026-08-10',
        amount: '500',
        reason: 'Late arrival',
      });
      expect(await payRow('EMP-002')).toEqual(other);
      expect(await payRow('EMP-004')).toEqual(own);
    });
  });

  describe('a quick leave is a real leave everywhere (AC-10, AC-39, AC-52 style)', () => {
    const quick = () => payroll().addQuickLeave({ employeeId: 'emp-004', date: '2026-09-21' });

    it('starts with the Leave tab, balance, On leave count and Leaves column agreeing', async () => {
      await start();
      expect(await onLeaveTile()).toBe(1);
      expect((await leaveTab()).count).toBe('Leave 10');
      expect(await casualBalance()).toEqual(['Casual Leave', '7.00', '5.00', '2.00', '0.00']);
      expect((await payRow('EMP-004'))['Leaves']).toBe('N/A');
    });

    it('appears in the Leave tab as Approved, uses a Casual day, counts On leave and fills Leaves', async () => {
      await start();
      const result = await quick();
      expect(result.ok).toBeTrue();

      const tab = await leaveTab();
      expect(tab.count).toBe('Leave 11');
      expect(
        tab.rows.some(
          row => row.includes('EMP-004') && row.includes('Approved') && !row.includes('Pending')
        )
      ).toBeTrue();
      expect(await casualBalance()).toEqual(['Casual Leave', '7.00', '4.00', '3.00', '0.00']);
      expect(await onLeaveTile()).toBe(2);
      expect(await staffRow('EMP-004')).toContain('On leave');
      expect((await payRow('EMP-004'))['Leaves']).toBe('1');
    });

    it('leaves pay unchanged because approved leave never creates nopay (AC-12)', async () => {
      await start();
      const before = await payRow('EMP-004');
      expect((await quick()).ok).toBeTrue();
      const after = await payRow('EMP-004');
      expect({ ...after, Leaves: '' }).toEqual({ ...before, Leaves: '' });
    });

    it('is refused for a second leave on the same day and creates nothing', async () => {
      await start();
      expect((await quick()).ok).toBeTrue();
      const again = await quick();
      expect(again.ok).toBeFalse();
      expect((await leaveTab()).count).toBe('Leave 11');
      expect((await payRow('EMP-004'))['Leaves']).toBe('1');
    });

    it('shows the leave month only on the pay row of the month of its date', async () => {
      await start();
      expect(
        (await payroll().addQuickLeave({ employeeId: 'emp-004', date: '2026-10-05' })).ok
      ).toBeTrue();
      expect((await payRow('EMP-004'))['Leaves']).toBe('N/A');
      expect(await onLeaveTile()).toBe(1);
    });
  });

  describe('permission changes apply in the same session (AC-66)', () => {
    it('hides Payroll from a Manager whose Payroll access is removed and stops the actions', async () => {
      await start(UserRole.MANAGER);
      const buttons = async () => {
        const { element } = await show(EmployeesComponent);
        return Array.from(element.querySelectorAll('button')).map(text);
      };
      expect(await buttons()).toContain('Payroll');
      expect(TestBed.inject(PermissionService).canView(ModuleKey.PAYROLL)).toBeTrue();

      await grant(UserRole.MANAGER, { [ModuleKey.PAYROLL]: PermissionLevel.NONE });

      expect(await buttons()).not.toContain('Payroll');
      expect(TestBed.inject(PermissionService).canView(ModuleKey.PAYROLL)).toBeFalse();
      expect(TestBed.inject(PermissionService).canView(ModuleKey.EMPLOYEES)).toBeTrue();
    });

    it('gives a Manager the row menu once Payroll is set to Full and takes it away again', async () => {
      await start(UserRole.MANAGER);
      const menus = async () => {
        const { element } = await show(PayrollComponent);
        return element.querySelectorAll('app-payroll-row-menu').length;
      };
      expect(await menus()).toBe(0);

      await grant(UserRole.MANAGER, { [ModuleKey.PAYROLL]: PermissionLevel.FULL });
      expect(await menus()).toBeGreaterThan(0);

      await grant(UserRole.MANAGER, { [ModuleKey.PAYROLL]: PermissionLevel.VIEW });
      expect(await menus()).toBe(0);
      const refused = await payroll().addNopay({
        employeeId: 'emp-004',
        date: '2026-09-21',
        amount: '500',
        reason: 'Late arrival',
      });
      expect(refused.ok).toBeFalse();
    });
  });

  describe('a refresh starts from the original sample set (AC-69)', () => {
    it('forgets advances, nopay, quick leave and master edits', async () => {
      await start();
      const original = await payRow('EMP-004');
      await payroll().addSalaryAdvance({
        employeeId: 'emp-004',
        counter: 'Counter1',
        date: '2026-09-21',
        amount: '1000',
      });
      await payroll().addNopay({
        employeeId: 'emp-004',
        date: '2026-09-21',
        amount: '500',
        reason: 'Late arrival',
      });
      await payroll().addQuickLeave({ employeeId: 'emp-004', date: '2026-09-21' });
      await edit('emp-004', { basicSalary: '80000' });
      expect(await payRow('EMP-004')).not.toEqual(original);

      TestBed.resetTestingModule();
      clearBrowserStorage();
      await start();
      expect(await payRow('EMP-004')).toEqual(original);
      expect(await onLeaveTile()).toBe(1);
      expect((await leaveTab()).count).toBe('Leave 10');
    });
  });
});
