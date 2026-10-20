import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { LeaveReason } from '../models/enums/leave-reason.enum';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { ModuleKey } from '../models/enums/module-key.enum';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { buildLeaveRows } from '../utils/employee-list-filter.util';
import { balanceFor } from '../utils/leave-balance.util';
import { defaultPayrollFilters } from '../utils/payroll-list.util';
import { EmployeeDataService } from './data/employee-data.service';
import { LeaveDataService } from './data/leave-data.service';
import { NOPAY_SEED, SALARY_ADVANCE_SEED } from './data/in-memory/seed/payroll.seed';
import { PayrollDataService } from './data/payroll-data.service';
import { RoleDataService } from './data/role-data.service';
import { LeaveAdminService } from './leave-admin.service';
import { PayrollAdminService, NopayInput, SalaryAdvanceInput } from './payroll-admin.service';
import { PayrollService } from './payroll.service';
import { PermissionService } from './permission.service';

const CASUAL = 'lt-003';
const FILTERS = defaultPayrollFilters('2026-09-21');

const advance = (overrides: Partial<SalaryAdvanceInput> = {}): SalaryAdvanceInput => ({
  employeeId: 'emp-004',
  counter: 'Counter1',
  date: '2026-09-10',
  amount: '5000',
  ...overrides,
});

const nopay = (overrides: Partial<NopayInput> = {}): NopayInput => ({
  employeeId: 'emp-004',
  date: '2026-09-10',
  amount: '1000',
  reason: ' Absent ',
  ...overrides,
});

describe('PayrollAdminService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(PayrollAdminService);
  const advances = () => firstValueFrom(TestBed.inject(PayrollDataService).getAdvances());
  const nopays = () => firstValueFrom(TestBed.inject(PayrollDataService).getNopayEntries());
  const leaves = () => firstValueFrom(TestBed.inject(LeaveDataService).getRequests());
  const row = async (employeeId: string, tab: 'monthly' | 'daily' = 'monthly') =>
    (await firstValueFrom(TestBed.inject(PayrollService).getPayrollRows(tab, FILTERS))).find(
      item => item.employee.id === employeeId
    )!;
  const fresh = (role: UserRole) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    return signInAs(role);
  };
  const grant = async (role: UserRole, levels: Partial<Record<ModuleKey, PermissionLevel>>) => {
    const permissions = TestBed.inject(PermissionService);
    await permissions.load();
    const roleData = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleData.getMatrix());
    await firstValueFrom(
      roleData.saveMatrix({ ...matrix, [role]: { ...matrix[role], ...levels } })
    );
    await permissions.load();
  };
  const patchEmployee = async (id: string, patch: object) => {
    const employeeDataService = TestBed.inject(EmployeeDataService);
    const employee = (await firstValueFrom(employeeDataService.getAll())).find(
      item => item.id === id
    )!;
    await firstValueFrom(employeeDataService.save({ ...employee, ...patch }));
  };

  describe('permissions', () => {
    it('refuses every role without Full Payroll access on every method', async () => {
      for (const role of [UserRole.MANAGER, UserRole.PHARMACIST, UserRole.CASHIER]) {
        await fresh(role);
        const results = [
          await service().addSalaryAdvance(advance()),
          await service().addNopay(nopay()),
          await service().addQuickLeave({ employeeId: 'emp-005', date: '2026-09-22' }),
        ];
        for (const result of results) {
          expect(result.ok).withContext(role).toBeFalse();
          if (!result.ok) expect(result.reason).toBe('denied');
        }
        expect(await advances()).toHaveSize(SALARY_ADVANCE_SEED.length);
        expect(await nopays()).toHaveSize(NOPAY_SEED.length);
      }
    });

    it('refuses when nobody is signed in', async () => {
      expect((await service().addSalaryAdvance(advance())).ok).toBeFalse();
      expect((await service().addNopay(nopay())).ok).toBeFalse();
      expect(
        (await service().addQuickLeave({ employeeId: 'emp-005', date: '2026-09-22' })).ok
      ).toBeFalse();
      expect(await advances()).toHaveSize(SALARY_ADVANCE_SEED.length);
    });

    it('honours a changed matrix when Manager is granted Full Payroll', async () => {
      await grant(UserRole.MANAGER, { [ModuleKey.PAYROLL]: PermissionLevel.FULL });
      await signInAs(UserRole.MANAGER);
      expect((await service().addSalaryAdvance(advance())).ok).toBeTrue();
      expect((await service().addNopay(nopay())).ok).toBeTrue();
    });

    it('still needs Employees write for quick leave', async () => {
      await grant(UserRole.MANAGER, { [ModuleKey.PAYROLL]: PermissionLevel.FULL });
      await signInAs(UserRole.MANAGER);
      const result = await service().addQuickLeave({ employeeId: 'emp-005', date: '2026-09-22' });
      expect(result.ok).toBeFalse();
      if (!result.ok) expect(result.reason).toBe('denied');
    });

    it('refuses an Admin whose Payroll write was removed mid-session', async () => {
      await signInAs(UserRole.ADMIN);
      await grant(UserRole.ADMIN, { [ModuleKey.PAYROLL]: PermissionLevel.VIEW });
      const result = await service().addSalaryAdvance(advance());
      expect(result.ok).toBeFalse();
    });
  });

  describe('addSalaryAdvance', () => {
    it('saves a service-set advance and the row net decreases', async () => {
      await signInAs(UserRole.ADMIN);
      const before = await row('emp-004');
      const result = await service().addSalaryAdvance(advance());
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.advance.amountCents).toBe(500000);
      expect(result.advance.employeeId).toBe('emp-004');
      expect(result.advance.createdAt).toContain('2026-09-21T');
      expect(await advances()).toHaveSize(SALARY_ADVANCE_SEED.length + 1);
      const after = await row('emp-004');
      expect(after.pay.salaryAdvanceCents).toBe(before.pay.salaryAdvanceCents + 500000);
      expect(after.pay.netCents).toBe(before.pay.netCents - 500000);
    });

    it('ignores tampered id, createdAt and amountCents', async () => {
      await signInAs(UserRole.ADMIN);
      const tampered = {
        ...advance(),
        id: 'adv-001',
        createdAt: '1999-01-01',
        amountCents: 1,
      } as SalaryAdvanceInput;
      const result = await service().addSalaryAdvance(tampered);
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.advance.id).not.toBe('adv-001');
      expect(result.advance.createdAt).toContain('2026-09-21T');
      expect(result.advance.amountCents).toBe(500000);
      expect((await advances()).find(item => item.id === 'adv-001')!.amountCents).toBe(1000000);
    });

    it('saves nothing and reports the first error field for invalid input', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().addSalaryAdvance(
        advance({ counter: '', date: '2026-02-31', amount: '-5' })
      );
      expect(result.ok).toBeFalse();
      if (!result.ok) {
        expect(result.reason).toBe('invalid');
        expect(result.firstErrorField).toBe('counter');
        expect(result.errors['date']).toBeDefined();
        expect(result.errors['amount']).toBeDefined();
      }
      expect(await advances()).toHaveSize(SALARY_ADVANCE_SEED.length);
    });

    it('refuses an amount above that month gross', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().addSalaryAdvance(advance({ amount: '99999999' }));
      expect(result.ok).toBeFalse();
      if (!result.ok) expect(result.firstErrorField).toBe('amount');
      expect(await advances()).toHaveSize(SALARY_ADVANCE_SEED.length);
    });

    it('catches a stale gross using freshly read employee data', async () => {
      await signInAs(UserRole.ADMIN);
      expect((await service().addSalaryAdvance(advance({ amount: '50000' }))).ok).toBeTrue();
      await patchEmployee('emp-004', {
        basicSalaryCents: 1000000,
        allowances: [],
        commissionRate: 0,
        overTimeRateCents: 0,
      });
      const result = await service().addSalaryAdvance(advance({ amount: '20000' }));
      expect(result.ok).toBeFalse();
      if (!result.ok) expect(result.errors['amount']).toContain('gross salary');
      expect(await advances()).toHaveSize(SALARY_ADVANCE_SEED.length + 1);
    });

    it('uses the month of the chosen date', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().addSalaryAdvance(advance({ date: '2026-08-05' }));
      expect(result.ok).toBeTrue();
      const august = await firstValueFrom(
        TestBed.inject(PayrollService).getPayrollRows('monthly', { ...FILTERS, month: 8 })
      );
      expect(august.find(item => item.employee.id === 'emp-004')!.pay.salaryAdvanceCents).toBe(
        500000
      );
    });

    it('refuses an Inactive employee and an unknown one', async () => {
      await signInAs(UserRole.ADMIN);
      const inactive = await service().addSalaryAdvance(advance({ employeeId: 'emp-008' }));
      expect(inactive.ok).toBeFalse();
      if (!inactive.ok) expect(inactive.reason).toBe('not-allowed');
      const unknown = await service().addSalaryAdvance(advance({ employeeId: 'nope' }));
      expect(unknown.ok).toBeFalse();
      if (!unknown.ok) expect(unknown.reason).toBe('not-found');
      expect(await advances()).toHaveSize(SALARY_ADVANCE_SEED.length);
    });

    it('blocks a second submit while one is in flight', async () => {
      await signInAs(UserRole.ADMIN);
      const [first, second] = await Promise.all([
        service().addSalaryAdvance(advance()),
        service().addNopay(nopay()),
      ]);
      expect(first.ok).toBeTrue();
      expect(second.ok).toBeFalse();
      if (!second.ok) expect(second.reason).toBe('busy');
      expect(await advances()).toHaveSize(SALARY_ADVANCE_SEED.length + 1);
      expect(await nopays()).toHaveSize(NOPAY_SEED.length);
      expect((await service().addNopay(nopay())).ok).toBeTrue();
    });
  });

  describe('addNopay', () => {
    it('saves a trimmed nopay entry and the row net decreases', async () => {
      await signInAs(UserRole.ADMIN);
      const before = await row('emp-004');
      const result = await service().addNopay(nopay());
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.entry.reason).toBe('Absent');
      expect(result.entry.amountCents).toBe(100000);
      expect(result.entry.createdAt).toContain('2026-09-21T');
      const after = await row('emp-004');
      expect(after.pay.totalNopayCents).toBe(before.pay.totalNopayCents + 100000);
      expect(after.pay.netCents).toBe(before.pay.netCents - 100000);
    });

    it('ignores tampered fields', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().addNopay({
        ...nopay(),
        id: 'nop-001',
        createdAt: '1999-01-01',
      } as NopayInput);
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.entry.id).not.toBe('nop-001');
      expect(result.entry.createdAt).toContain('2026-09-21T');
    });

    it('saves nothing for an empty reason, an oversized reason or an amount above gross', async () => {
      await signInAs(UserRole.ADMIN);
      for (const bad of [
        nopay({ reason: '  ' }),
        nopay({ reason: 'x'.repeat(251) }),
        nopay({ amount: '99999999' }),
        nopay({ amount: '1e3' }),
        nopay({ date: '' }),
      ]) {
        const result = await service().addNopay(bad);
        expect(result.ok).toBeFalse();
        if (!result.ok) expect(result.reason).toBe('invalid');
      }
      expect(await nopays()).toHaveSize(NOPAY_SEED.length);
    });

    it('catches a stale gross and refuses Inactive employees', async () => {
      await signInAs(UserRole.ADMIN);
      await patchEmployee('emp-004', {
        basicSalaryCents: 1000000,
        allowances: [],
        commissionRate: 0,
        overTimeRateCents: 0,
      });
      const stale = await service().addNopay(nopay({ amount: '20000' }));
      expect(stale.ok).toBeFalse();
      const inactive = await service().addNopay(nopay({ employeeId: 'emp-008' }));
      expect(inactive.ok).toBeFalse();
      if (!inactive.ok) expect(inactive.reason).toBe('not-allowed');
      expect(await nopays()).toHaveSize(NOPAY_SEED.length);
    });
  });

  describe('addQuickLeave', () => {
    const quick = (date = '2026-09-22', employeeId = 'emp-005') => ({ employeeId, date });

    it('creates an approved one-day Casual Leave with service-set fields', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().addQuickLeave(quick());
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      const request = result.request;
      expect(request.status).toBe(LeaveStatus.APPROVED);
      expect(request.leaveTypeId).toBe(CASUAL);
      expect(request.reason).toBe(LeaveReason.OTHER);
      expect(request.comments).toBe('Added from Payroll');
      expect(request.fromDate).toBe('2026-09-22');
      expect(request.toDate).toBe('2026-09-22');
      expect(request.days).toBe(1);
      expect(request.decidedAt).toContain('2026-09-21T');
      expect(request.createdAt).toContain('2026-09-21T');
    });

    it('ignores tampered approver, status and actor fields', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().addQuickLeave({
        ...quick(),
        approverEmployeeId: 'emp-005',
        status: LeaveStatus.REJECTED,
        id: 'leave-001',
      } as never);
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.request.approverEmployeeId).toBe('emp-001');
      expect(result.request.status).toBe(LeaveStatus.APPROVED);
      expect(result.request.id).not.toBe('leave-001');
    });

    it('derives the approver from the signed-in user linked employee', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().addQuickLeave(quick());
      expect(result.ok && result.request.approverEmployeeId).toBe('emp-001');
    });

    it('falls back to another eligible approver when the signed-in person is the applicant', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().addQuickLeave(quick('2026-09-22', 'emp-001'));
      expect(result.ok).toBeTrue();
      if (result.ok) expect(result.request.approverEmployeeId).toBe('emp-002');
    });

    it('falls back when the signed-in person is not an eligible approver', async () => {
      await signInAs(UserRole.ADMIN);
      await patchEmployee('emp-001', { userId: null });
      const result = await service().addQuickLeave(quick());
      expect(result.ok).toBeTrue();
      if (result.ok) expect(result.request.approverEmployeeId).toBe('emp-002');
    });

    it('refuses with a clear message when no eligible approver exists', async () => {
      await signInAs(UserRole.ADMIN);
      await patchEmployee('emp-001', { status: EmployeeStatus.INACTIVE });
      await patchEmployee('emp-002', { status: EmployeeStatus.INACTIVE });
      const result = await service().addQuickLeave(quick());
      expect(result.ok).toBeFalse();
      if (!result.ok) {
        expect(result.reason).toBe('not-allowed');
        expect(result.message).toContain('No active Admin or Manager');
      }
      expect(await leaves()).toHaveSize(10);
    });

    it('never lets the applicant approve their own leave', async () => {
      await signInAs(UserRole.ADMIN);
      await patchEmployee('emp-002', { status: EmployeeStatus.INACTIVE });
      const result = await service().addQuickLeave(quick('2026-09-22', 'emp-001'));
      expect(result.ok).toBeFalse();
      if (!result.ok) expect(result.reason).toBe('not-allowed');
    });

    it('honours the balance and returns the leave rule message', async () => {
      await signInAs(UserRole.ADMIN);
      const leaveAdminService = TestBed.inject(LeaveAdminService);
      const used = await leaveAdminService.apply({
        employeeId: 'emp-005',
        year: 2026,
        leaveTypeId: CASUAL,
        fromDate: '2026-11-02',
        toDate: '2026-11-08',
        reason: LeaveReason.OTHER,
        comments: '',
        attachment: null,
        coveringEmployeeId: '',
        approverEmployeeId: 'emp-002',
      });
      expect(used.ok).toBeTrue();
      const result = await service().addQuickLeave(quick('2026-12-01'));
      expect(result.ok).toBeFalse();
      if (!result.ok) {
        expect(result.reason).toBe('invalid');
        expect(result.firstErrorField).toBe('date');
        expect(result.errors['date']).toContain('no balance left');
        expect(result.message).toContain('no balance left');
      }
      expect(await leaves()).toHaveSize(11);
    });

    it('refuses an overlap with existing leave using fresh data', async () => {
      await signInAs(UserRole.ADMIN);
      expect((await service().addQuickLeave(quick())).ok).toBeTrue();
      const again = await service().addQuickLeave(quick());
      expect(again.ok).toBeFalse();
      if (!again.ok) {
        expect(again.errors['date']).toContain('Overlaps leave');
        expect(again.firstErrorField).toBe('date');
      }
      expect(await leaves()).toHaveSize(11);
    });

    it('refuses a date outside a valid leave year or not real', async () => {
      await signInAs(UserRole.ADMIN);
      for (const date of ['1850-05-05', '2026-02-31', '', 'abc']) {
        const result = await service().addQuickLeave(quick(date));
        expect(result.ok).withContext(date).toBeFalse();
        if (!result.ok) expect(result.reason).toBe('invalid');
      }
      expect(await leaves()).toHaveSize(10);
    });

    it('refuses Inactive and unknown employees', async () => {
      await signInAs(UserRole.ADMIN);
      const inactive = await service().addQuickLeave(quick('2026-09-22', 'emp-008'));
      expect(inactive.ok).toBeFalse();
      if (!inactive.ok) expect(inactive.reason).toBe('not-allowed');
      const unknown = await service().addQuickLeave(quick('2026-09-22', 'nope'));
      if (!unknown.ok) expect(unknown.reason).toBe('not-found');
    });

    it('is reflected in the Leaves column, balances and On leave counts', async () => {
      await signInAs(UserRole.ADMIN);
      const leaveDataService = TestBed.inject(LeaveDataService);
      const employees = await firstValueFrom(TestBed.inject(EmployeeDataService).getAll());
      const onLeaveBefore = buildLeaveRows(employees, await leaves(), '2026-09-22').length;
      const entitlements = await firstValueFrom(leaveDataService.getEntitlements());
      const balanceBefore = balanceFor('emp-005', CASUAL, 2026, entitlements, await leaves());
      expect((await row('emp-005', 'daily')).pay.leaves).toBeNull();

      expect((await service().addQuickLeave(quick())).ok).toBeTrue();

      expect((await row('emp-005', 'daily')).pay.leaves).toBe(1);
      const balanceAfter = balanceFor('emp-005', CASUAL, 2026, entitlements, await leaves());
      expect(balanceAfter.utilized).toBe(balanceBefore.utilized + 1);
      expect(balanceAfter.balance).toBe(balanceBefore.balance - 1);
      expect(buildLeaveRows(employees, await leaves(), '2026-09-22')).toHaveSize(onLeaveBefore + 1);
    });
  });
});
