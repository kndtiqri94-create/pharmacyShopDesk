import {
  PAYROLL_REASON_MAX,
  PayrollValidationContext,
  validateNopay,
  validateQuickLeaveDate,
  validateSalaryAdvance,
} from './payroll-validation.util';

const requestedMonths: string[] = [];
const CONTEXT: PayrollValidationContext = {
  counters: ['Counter1', 'Counter2'],
  grossCentsForMonth: month => {
    requestedMonths.push(month);
    return 1000000;
  },
};

const advance = (overrides: Partial<Parameters<typeof validateSalaryAdvance>[0]> = {}) =>
  validateSalaryAdvance(
    { counter: 'Counter1', date: '2026-09-10', amount: '5000.50', ...overrides },
    CONTEXT
  );

const nopay = (overrides: Partial<Parameters<typeof validateNopay>[0]> = {}) =>
  validateNopay({ date: '2026-09-10', amount: '100', reason: 'Late', ...overrides }, CONTEXT);

describe('validateSalaryAdvance', () => {
  beforeEach(() => requestedMonths.splice(0));

  it('accepts a valid advance and converts rupees to cents once', () => {
    const result = advance();
    expect(result.firstErrorField).toBeNull();
    expect(result.values).toEqual({ counter: 'Counter1', date: '2026-09-10', amountCents: 500050 });
    expect(requestedMonths).toEqual(['2026-09']);
  });

  it('accepts an amount equal to the month gross and refuses one cent more', () => {
    expect(advance({ amount: '10000' }).values).not.toBeNull();
    const over = advance({ amount: '10000.01' });
    expect(over.errors['amount']).toContain('Rs. 10,000.00');
    expect(over.values).toBeNull();
  });

  it('requires a counter from the settings list (AC-48)', () => {
    expect(advance({ counter: '' }).errors['counter']).toBe('Choose a counter');
    expect(advance({ counter: 'Counter9' }).errors['counter']).toBe(
      'Choose a counter from the list'
    );
  });

  it('refuses empty, impossible and badly formed dates', () => {
    expect(advance({ date: '' }).errors['date']).toBe('Choose a date');
    expect(advance({ date: '2026-02-31' }).errors['date']).toBe('Enter a real date');
    expect(advance({ date: 'tomorrow' }).errors['date']).toBe('Enter a real date');
  });

  it('refuses zero, negative, empty, NaN, scientific and over precise amounts (AC-45)', () => {
    for (const amount of ['0', '0.00', '-5', '', 'abc', 'NaN', '1e3', '12.345', '1,000']) {
      const result = advance({ amount });
      expect(result.errors['amount']).withContext(amount).toContain('above 0');
      expect(result.values).toBeNull();
    }
  });

  it('does not compare to gross when the date is invalid', () => {
    const result = advance({ date: 'x', amount: '99999999' });
    expect(Object.keys(result.errors)).toEqual(['date']);
  });

  it('reports the first error in field order', () => {
    expect(advance({ counter: '', date: '', amount: '' }).firstErrorField).toBe('counter');
    expect(advance({ date: '', amount: '' }).firstErrorField).toBe('date');
    expect(advance({ amount: '' }).firstErrorField).toBe('amount');
  });
});

describe('validateNopay', () => {
  it('accepts a valid entry and trims the reason', () => {
    const result = nopay({ reason: '  Late  ' });
    expect(result.values).toEqual({ date: '2026-09-10', amountCents: 10000, reason: 'Late' });
  });

  it('refuses an amount of zero, invalid, or above that month gross (AC-50, 51)', () => {
    expect(nopay({ amount: '0' }).errors['amount']).toContain('above 0');
    expect(nopay({ amount: 'x' }).errors['amount']).toContain('above 0');
    expect(nopay({ amount: '10000.01' }).errors['amount']).toContain("month's gross salary");
    expect(nopay({ amount: '10000' }).values).not.toBeNull();
  });

  it('requires a reason of at most 250 characters (AC-52)', () => {
    expect(nopay({ reason: '' }).errors['reason']).toBe('Enter the reason');
    expect(nopay({ reason: '   ' }).errors['reason']).toBe('Enter the reason');
    expect(nopay({ reason: 'a'.repeat(PAYROLL_REASON_MAX) }).values).not.toBeNull();
    expect(nopay({ reason: 'a'.repeat(PAYROLL_REASON_MAX + 1) }).errors['reason']).toContain('250');
  });

  it('refuses an impossible date and orders errors date, amount, reason', () => {
    expect(nopay({ date: '2026-13-01' }).errors['date']).toBe('Enter a real date');
    expect(nopay({ date: '', amount: '', reason: '' }).firstErrorField).toBe('date');
    expect(nopay({ amount: '', reason: '' }).firstErrorField).toBe('amount');
    expect(nopay({ reason: '' }).firstErrorField).toBe('reason');
  });
});

describe('validateQuickLeaveDate', () => {
  it('accepts a real date', () => {
    expect(validateQuickLeaveDate({ date: '2026-09-21' }).values).toEqual({ date: '2026-09-21' });
  });

  it('refuses an empty or impossible date (AC-42)', () => {
    const empty = validateQuickLeaveDate({ date: '' });
    expect(empty.errors['date']).toBe('Choose a date');
    expect(empty.firstErrorField).toBe('date');
    expect(empty.values).toBeNull();
    expect(validateQuickLeaveDate({ date: '2026-02-30' }).errors['date']).toBe('Enter a real date');
  });
});
