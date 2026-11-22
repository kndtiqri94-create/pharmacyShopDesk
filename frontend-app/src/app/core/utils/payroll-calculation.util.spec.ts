import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import {
  NOPAY_SEED,
  PAYROLL_INPUT_SEED,
  PAYROLL_SETTINGS_SEED,
  SALARY_ADVANCE_SEED,
} from '../services/data/in-memory/seed/payroll.seed';
import { Employee } from '../models/domain/employee.model';
import { LeaveRequest } from '../models/domain/leave-request.model';
import { NopayEntry } from '../models/domain/nopay-entry.model';
import { PayrollInput } from '../models/domain/payroll-input.model';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { PayrollPaymentStatus } from '../models/enums/payroll-payment-status.enum';
import {
  approvedLeaveDaysInMonth,
  calculatePayroll,
  monthOfDate,
} from './payroll-calculation.util';

const SEPT = '2026-09';

function employee(id: string): Employee {
  const found = EMPLOYEE_SEED.find(candidate => candidate.id === id);
  if (found === undefined) throw new Error(`missing ${id}`);
  return found;
}

function inputOf(id: string, month: string): PayrollInput | null {
  return PAYROLL_INPUT_SEED.find(input => input.employeeId === id && input.month === month) ?? null;
}

function pay(id: string, month = SEPT) {
  return calculatePayroll(
    employee(id),
    month,
    inputOf(id, month),
    SALARY_ADVANCE_SEED,
    NOPAY_SEED,
    PAYROLL_SETTINGS_SEED
  );
}

function leave(overrides: Partial<LeaveRequest>): LeaveRequest {
  return {
    id: 'lv',
    employeeId: 'emp-001',
    fromDate: '2026-09-10',
    toDate: '2026-09-10',
    status: LeaveStatus.APPROVED,
    ...overrides,
  } as LeaveRequest;
}

describe('calculatePayroll', () => {
  it('works out a Monthly employee with EPF, ETF and tax (AC-1, 2, 6, 7, 8)', () => {
    const row = pay('emp-001');
    expect(row.basicCents).toBe(25000000);
    expect(row.allowanceCents).toBe(5000000);
    expect(row.grossCents).toBe(30000000);
    expect(row.epfDeductionCents).toBe(2000000);
    expect(row.payeeTaxCents).toBe(2700000);
    expect(row.netCents).toBe(25300000);
    expect(row.employerEpfCents).toBe(3000000);
    expect(row.employerEtfCents).toBe(750000);
    expect(row.loanDeductionCents).toBeNull();
    expect(row.shortfallWarning).toBeFalse();
  });

  it('adds commission from the base and over time from hours x rate (AC-3, 5)', () => {
    const row = pay('emp-002');
    expect(row.commissionCents).toBe(1160000);
    expect(row.overTimeCents).toBe(750000);
    expect(row.grossCents).toBe(15000000 + 2000000 + 1160000 + 750000);
    expect(row.payeeTaxCents).toBe(769200);
    expect(row.netCents).toBe(row.grossCents - 1200000 - 769200);
  });

  it('gives zero over time without hours or without a rate, and zero commission without rate or base (AC-3, 4, 5)', () => {
    const noHours = calculatePayroll(
      employee('emp-002'),
      SEPT,
      null,
      [],
      [],
      PAYROLL_SETTINGS_SEED
    );
    expect(noHours.overTimeCents).toBe(0);
    expect(noHours.commissionCents).toBe(0);
    const noRate = calculatePayroll(
      { ...employee('emp-002'), overTimeRateCents: 0, commissionRate: 0 },
      SEPT,
      inputOf('emp-002', SEPT),
      [],
      [],
      PAYROLL_SETTINGS_SEED
    );
    expect(noRate.overTimeCents).toBe(0);
    expect(noRate.commissionCents).toBe(0);
  });

  it('uses daily rate x days worked for a Daily employee and shows the daily rate as Basic (OQ12)', () => {
    const row = pay('emp-005');
    expect(row.basicCents).toBe(250000);
    expect(row.daysWorked).toBe(20);
    expect(row.basicEarnedCents).toBe(5000000);
    expect(row.commissionCents).toBe(150000);
    expect(row.grossCents).toBe(5000000 + 30000 + 150000);
    expect(row.epfDeductionCents).toBeNull();
    expect(row.employerEpfCents).toBe(0);
    expect(row.employerEtfCents).toBe(0);
    expect(row.salaryAdvanceCents).toBe(300000);
    expect(row.netCents).toBe(4880000);
  });

  it('applies EPF on the basic earned for a Daily employee with EPF only', () => {
    const row = pay('emp-006');
    expect(row.basicEarnedCents).toBe(4320000);
    expect(row.epfDeductionCents).toBe(345600);
    expect(row.employerEpfCents).toBe(518400);
    expect(row.employerEtfCents).toBe(0);
    expect(row.totalNopayCents).toBe(120000);
    expect(row.netCents).toBe(4320000 - 345600 - 120000);
  });

  it('keeps daysWorked null for Monthly employees', () => {
    expect(pay('emp-001').daysWorked).toBeNull();
  });

  it('handles an employee with no salary (zero, no warning, EPF 0 not N/A)', () => {
    const row = pay('emp-007');
    expect(row.grossCents).toBe(0);
    expect(row.netCents).toBe(0);
    expect(row.epfDeductionCents).toBe(0);
    expect(row.shortfallWarning).toBeFalse();
  });

  it('assigns advances and nopay to the month of their date (AC-11)', () => {
    expect(pay('emp-002', '2026-07').salaryAdvanceCents).toBe(2000000);
    expect(pay('emp-002', '2026-09').salaryAdvanceCents).toBe(0);
    expect(pay('emp-003', '2026-08').totalNopayCents).toBe(400000);
    expect(pay('emp-003', '2026-09').totalNopayCents).toBe(0);
    expect(monthOfDate('2026-09-30')).toBe('2026-09');
  });

  it('sums several entries in one month and ignores other employees', () => {
    const extra: NopayEntry[] = [
      {
        id: 'a',
        employeeId: 'emp-004',
        date: '2026-09-20',
        amountCents: 100000,
        reason: 'x',
        createdAt: '',
      },
      {
        id: 'b',
        employeeId: 'emp-001',
        date: '2026-09-20',
        amountCents: 999,
        reason: 'x',
        createdAt: '',
      },
    ];
    const row = calculatePayroll(
      employee('emp-004'),
      SEPT,
      null,
      [],
      [...NOPAY_SEED, ...extra],
      PAYROLL_SETTINGS_SEED
    );
    expect(row.totalNopayCents).toBe(350000);
  });

  it('clamps net at zero and warns when deductions exceed gross (AC-14)', () => {
    const entry: NopayEntry = {
      id: 'n',
      employeeId: 'emp-006',
      date: '2026-09-05',
      amountCents: 150000,
      reason: 'x',
      createdAt: '',
    };
    const row = calculatePayroll(
      { ...employee('emp-006'), basicSalaryCents: 100000, calculateEpf: false },
      SEPT,
      {
        id: 'i',
        employeeId: 'emp-006',
        month: SEPT,
        overtimeHours: 0,
        commissionBaseCents: 0,
        daysWorked: 1,
      },
      [],
      [entry],
      PAYROLL_SETTINGS_SEED
    );
    expect(row.grossCents).toBe(100000);
    expect(row.netCents).toBe(0);
    expect(row.shortfallWarning).toBeTrue();
  });

  it('does not warn when deductions equal gross', () => {
    const entry: NopayEntry = {
      id: 'n',
      employeeId: 'emp-001',
      date: '2026-09-05',
      amountCents: 100000,
      reason: 'x',
      createdAt: '',
    };
    const row = calculatePayroll(
      { ...employee('emp-001'), basicSalaryCents: 100000, allowances: [], calculateEpf: false },
      SEPT,
      null,
      [],
      [entry],
      PAYROLL_SETTINGS_SEED
    );
    expect(row.netCents).toBe(0);
    expect(row.shortfallWarning).toBeFalse();
  });

  it('keeps integer cents with half up rounding (AC-16)', () => {
    const base = { ...employee('emp-004'), allowances: [], calculateEpf: true };
    const epf = calculatePayroll(
      { ...base, basicSalaryCents: 12345 },
      SEPT,
      null,
      [],
      [],
      PAYROLL_SETTINGS_SEED
    );
    expect(epf.epfDeductionCents).toBe(988);
    const overtime = calculatePayroll(
      { ...base, basicSalaryCents: 0, overTimeRateCents: 33 },
      SEPT,
      {
        id: 'i',
        employeeId: 'emp-004',
        month: SEPT,
        overtimeHours: 0.5,
        commissionBaseCents: 0,
        daysWorked: 0,
      },
      [],
      [],
      PAYROLL_SETTINGS_SEED
    );
    expect(overtime.overTimeCents).toBe(17);
    for (const value of [epf.grossCents, epf.netCents, overtime.grossCents, overtime.netCents]) {
      expect(Number.isInteger(value)).toBeTrue();
    }
  });

  it('shows components that add up to Gross and Net (AC-16)', () => {
    for (const id of ['emp-001', 'emp-002', 'emp-003', 'emp-004', 'emp-005', 'emp-006']) {
      const row = pay(id);
      expect(row.grossCents).toBe(
        row.basicEarnedCents + row.allowanceCents + row.commissionCents + row.overTimeCents
      );
      expect(row.netCents).toBe(Math.max(0, row.grossCents - row.deductionsCents));
    }
  });

  it('follows changed settings (AC-10)', () => {
    const row = calculatePayroll(employee('emp-001'), SEPT, null, [], [], {
      ...PAYROLL_SETTINGS_SEED,
      epfEmployeeRate: 10,
      taxSlabs: [],
    });
    expect(row.epfDeductionCents).toBe(2500000);
    expect(row.payeeTaxCents).toBe(0);
  });

  it('shows N/A leaves for none and the count otherwise, without creating nopay (AC-12, 23)', () => {
    const none = calculatePayroll(employee('emp-001'), SEPT, null, [], [], PAYROLL_SETTINGS_SEED);
    const some = calculatePayroll(
      employee('emp-001'),
      SEPT,
      null,
      [],
      [],
      PAYROLL_SETTINGS_SEED,
      3
    );
    expect(none.leaves).toBeNull();
    expect(some.leaves).toBe(3);
    expect(some.totalNopayCents).toBe(0);
    expect(some.netCents).toBe(none.netCents);
  });

  it('passes the payment status through and defaults to Unpaid', () => {
    expect(pay('emp-001').paymentStatus).toBe(PayrollPaymentStatus.UNPAID);
    const paid = calculatePayroll(
      employee('emp-001'),
      SEPT,
      null,
      [],
      [],
      PAYROLL_SETTINGS_SEED,
      0,
      PayrollPaymentStatus.PAID
    );
    expect(paid.paymentStatus).toBe(PayrollPaymentStatus.PAID);
  });

  it('does not modify its inputs', () => {
    const source = employee('emp-002');
    const copy = JSON.stringify(source);
    pay('emp-002');
    expect(JSON.stringify(source)).toBe(copy);
  });
});

describe('approvedLeaveDaysInMonth', () => {
  it('counts only approved days of that employee inside the month', () => {
    const leaves = [
      leave({ id: '1', fromDate: '2026-08-30', toDate: '2026-09-02' }),
      leave({ id: '2', status: LeaveStatus.PENDING, fromDate: '2026-09-10', toDate: '2026-09-11' }),
      leave({ id: '3', employeeId: 'emp-002', fromDate: '2026-09-10', toDate: '2026-09-12' }),
      leave({ id: '4', fromDate: '2026-09-20', toDate: '2026-09-20' }),
    ];
    expect(approvedLeaveDaysInMonth(leaves, 'emp-001', '2026-09')).toBe(3);
    expect(approvedLeaveDaysInMonth(leaves, 'emp-001', '2026-08')).toBe(2);
    expect(approvedLeaveDaysInMonth(leaves, 'emp-001', '2026-10')).toBe(0);
  });

  it('returns 0 for a bad month key', () => {
    expect(approvedLeaveDaysInMonth([leave({})], 'emp-001', '2026-13')).toBe(0);
  });
});
