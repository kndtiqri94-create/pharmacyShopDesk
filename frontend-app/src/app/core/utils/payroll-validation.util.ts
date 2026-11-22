import { isIsoDate } from './date.util';
import { formatRupeesExact, rupeesToCents } from './money.util';
import { monthOfDate } from './payroll-calculation.util';
import { parseNonNegativeNumber } from './product-validation.util';

export const PAYROLL_REASON_MAX = 250;
const MONEY_DECIMALS = 2;

export type PayrollFieldErrors = Record<string, string>;

export interface PayrollValidationContext {
  counters: readonly string[];
  grossCentsForMonth: (month: string) => number;
}

export interface SalaryAdvanceFormInput {
  counter: string;
  date: string;
  amount: string;
}

export interface NopayFormInput {
  date: string;
  amount: string;
  reason: string;
}

export interface QuickLeaveFormInput {
  date: string;
}

export interface ValidatedSalaryAdvance {
  counter: string;
  date: string;
  amountCents: number;
}

export interface ValidatedNopay {
  date: string;
  amountCents: number;
  reason: string;
}

export interface ValidatedQuickLeave {
  date: string;
}

export interface PayrollValidationResult<T> {
  errors: PayrollFieldErrors;
  firstErrorField: string | null;
  values: T | null;
}

const ADVANCE_FIELD_ORDER = ['counter', 'date', 'amount'] as const;
const NOPAY_FIELD_ORDER = ['date', 'amount', 'reason'] as const;
const LEAVE_FIELD_ORDER = ['date'] as const;

function checkDate(errors: PayrollFieldErrors, text: string): string | null {
  const date = text.trim();
  if (date.length === 0) {
    errors['date'] = 'Choose a date';
    return null;
  }
  if (!isIsoDate(date)) {
    errors['date'] = 'Enter a real date';
    return null;
  }
  return date;
}

function checkAmount(
  errors: PayrollFieldErrors,
  text: string,
  date: string | null,
  context: PayrollValidationContext,
  subject: string
): number {
  const rupees = parseNonNegativeNumber(text, MONEY_DECIMALS);
  if (rupees === null || rupees <= 0) {
    errors['amount'] = `The ${subject} must be above 0, with up to two decimals`;
    return 0;
  }
  const cents = rupeesToCents(rupees);
  if (date !== null) {
    const gross = context.grossCentsForMonth(monthOfDate(date));
    if (cents > gross) {
      errors['amount'] =
        `The ${subject} cannot be more than that month's gross salary of ${formatRupeesExact(gross)}`;
    }
  }
  return cents;
}

function firstError(errors: PayrollFieldErrors, order: readonly string[]): string | null {
  return order.find(key => errors[key] !== undefined) ?? null;
}

function finish<T>(
  errors: PayrollFieldErrors,
  order: readonly string[],
  values: T
): PayrollValidationResult<T> {
  const firstErrorField = firstError(errors, order);
  return firstErrorField === null
    ? { errors, firstErrorField, values }
    : { errors, firstErrorField, values: null };
}

export function validateSalaryAdvance(
  input: SalaryAdvanceFormInput,
  context: PayrollValidationContext
): PayrollValidationResult<ValidatedSalaryAdvance> {
  const errors: PayrollFieldErrors = {};
  const counter = input.counter.trim();
  if (counter.length === 0) errors['counter'] = 'Choose a counter';
  else if (!context.counters.includes(counter))
    errors['counter'] = 'Choose a counter from the list';
  const date = checkDate(errors, input.date);
  const amountCents = checkAmount(errors, input.amount, date, context, 'advance amount');
  return finish(errors, ADVANCE_FIELD_ORDER, { counter, date: date ?? '', amountCents });
}

export function validateNopay(
  input: NopayFormInput,
  context: PayrollValidationContext
): PayrollValidationResult<ValidatedNopay> {
  const errors: PayrollFieldErrors = {};
  const date = checkDate(errors, input.date);
  const amountCents = checkAmount(errors, input.amount, date, context, 'nopay amount');
  const reason = input.reason.trim();
  if (reason.length === 0) errors['reason'] = 'Enter the reason';
  else if (reason.length > PAYROLL_REASON_MAX) {
    errors['reason'] = `The reason must be ${PAYROLL_REASON_MAX} characters or fewer`;
  }
  return finish(errors, NOPAY_FIELD_ORDER, { date: date ?? '', amountCents, reason });
}

export function validateQuickLeaveDate(
  input: QuickLeaveFormInput
): PayrollValidationResult<ValidatedQuickLeave> {
  const errors: PayrollFieldErrors = {};
  const date = checkDate(errors, input.date);
  return finish(errors, LEAVE_FIELD_ORDER, { date: date ?? '' });
}
