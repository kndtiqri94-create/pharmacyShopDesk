import { Employee } from '../models/domain/employee.model';
import { LeaveRequest } from '../models/domain/leave-request.model';
import { NopayEntry } from '../models/domain/nopay-entry.model';
import { PayrollInput } from '../models/domain/payroll-input.model';
import { PayrollSettings } from '../models/domain/payroll-settings.model';
import { SalaryAdvance } from '../models/domain/salary-advance.model';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { PayrollPaymentStatus } from '../models/enums/payroll-payment-status.enum';
import { SalaryType } from '../models/enums/salary-type.enum';
import { daysBetween, endOfMonth } from './date.util';
import { divideRoundHalfUp } from './money.util';
import { calculatePayeeTax, percentOfCents } from './payroll-tax.util';

const QUANTITY_SCALE = 100;

/**
 * All amounts are integer cents. Every division goes through divideRoundHalfUp
 * (half up, integer arithmetic), so results never drift. For Daily employees
 * basicSalaryCents is the daily rate: the Basic column shows that rate, while
 * Gross and EPF use the basic earned (daily rate x days worked).
 */
export interface PayrollCalculation {
  employeeId: string;
  month: string;
  salaryType: SalaryType;
  basicCents: number;
  daysWorked: number | null;
  basicEarnedCents: number;
  allowanceCents: number;
  commissionCents: number;
  salaryAdvanceCents: number;
  leaves: number | null;
  totalNopayCents: number;
  epfDeductionCents: number | null;
  loanDeductionCents: null;
  payeeTaxCents: number;
  overTimeCents: number;
  grossCents: number;
  deductionsCents: number;
  netCents: number;
  shortfallWarning: boolean;
  employerEpfCents: number;
  employerEtfCents: number;
  paymentStatus: PayrollPaymentStatus;
}

export function monthOfDate(date: string): string {
  return date.slice(0, 7);
}

function nonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function timesQuantity(cents: number, quantity: number): number {
  const scaled = Math.round(nonNegative(quantity) * QUANTITY_SCALE);
  return divideRoundHalfUp(nonNegative(cents) * scaled, QUANTITY_SCALE);
}

export function approvedLeaveDaysInMonth(
  leaves: readonly LeaveRequest[],
  employeeId: string,
  month: string
): number {
  const monthStart = `${month}-01`;
  const monthEnd = endOfMonth(monthStart);
  if (monthEnd === '') return 0;
  return leaves
    .filter(leave => leave.employeeId === employeeId && leave.status === LeaveStatus.APPROVED)
    .reduce((total, leave) => {
      const from = leave.fromDate > monthStart ? leave.fromDate : monthStart;
      const to = leave.toDate < monthEnd ? leave.toDate : monthEnd;
      const days = daysBetween(from, to) + 1;
      return total + (days > 0 ? days : 0);
    }, 0);
}

function sumInMonth(
  entries: readonly { employeeId: string; date: string; amountCents: number }[],
  employeeId: string,
  month: string
): number {
  return entries
    .filter(entry => entry.employeeId === employeeId && monthOfDate(entry.date) === month)
    .reduce((total, entry) => total + nonNegative(entry.amountCents), 0);
}

export function calculatePayroll(
  employee: Employee,
  month: string,
  input: PayrollInput | null,
  advances: readonly SalaryAdvance[],
  nopayEntries: readonly NopayEntry[],
  settings: PayrollSettings,
  approvedLeaveDays = 0,
  paymentStatus: PayrollPaymentStatus = PayrollPaymentStatus.UNPAID
): PayrollCalculation {
  const isDaily = employee.salaryType === SalaryType.DAILY;
  const daysWorked = isDaily ? nonNegative(input?.daysWorked ?? 0) : null;
  const basicCents = nonNegative(employee.basicSalaryCents);
  const basicEarnedCents = isDaily ? timesQuantity(basicCents, daysWorked ?? 0) : basicCents;
  const allowanceCents = employee.allowances.reduce(
    (total, allowance) => total + nonNegative(allowance.amountCents),
    0
  );
  const commissionCents = percentOfCents(input?.commissionBaseCents ?? 0, employee.commissionRate);
  const overTimeCents = timesQuantity(employee.overTimeRateCents, input?.overtimeHours ?? 0);
  const grossCents = basicEarnedCents + allowanceCents + commissionCents + overTimeCents;

  const salaryAdvanceCents = sumInMonth(advances, employee.id, month);
  const totalNopayCents = sumInMonth(nopayEntries, employee.id, month);
  const epfDeductionCents = employee.calculateEpf
    ? percentOfCents(basicEarnedCents, settings.epfEmployeeRate)
    : null;
  const payeeTaxCents = calculatePayeeTax(grossCents, settings.taxSlabs);
  const deductionsCents =
    totalNopayCents + salaryAdvanceCents + (epfDeductionCents ?? 0) + payeeTaxCents;

  return {
    employeeId: employee.id,
    month,
    salaryType: employee.salaryType,
    basicCents,
    daysWorked,
    basicEarnedCents,
    allowanceCents,
    commissionCents,
    salaryAdvanceCents,
    leaves: approvedLeaveDays > 0 ? approvedLeaveDays : null,
    totalNopayCents,
    epfDeductionCents,
    loanDeductionCents: null,
    payeeTaxCents,
    overTimeCents,
    grossCents,
    deductionsCents,
    netCents: Math.max(0, grossCents - deductionsCents),
    shortfallWarning: deductionsCents > grossCents,
    employerEpfCents: employee.calculateEpf
      ? percentOfCents(basicEarnedCents, settings.epfEmployerRate)
      : 0,
    employerEtfCents: employee.calculateEtf
      ? percentOfCents(basicEarnedCents, settings.etfEmployerRate)
      : 0,
    paymentStatus,
  };
}
