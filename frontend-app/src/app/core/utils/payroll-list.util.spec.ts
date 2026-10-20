import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import {
  defaultPayrollFilters,
  paginatePayrollRows,
  parsePayrollTab,
  payrollMonthChoices,
  payrollMonthKey,
  payrollMonthLabel,
  payrollYearChoices,
  selectPayrollEmployees,
} from './payroll-list.util';

const FILTERS = defaultPayrollFilters('2026-09-21');
const names = (list: readonly { name: string }[]) => list.map(item => item.name);

describe('payroll list util', () => {
  it('defaults to the current month from the passed in today', () => {
    expect(FILTERS).toEqual({ keyword: '', location: '', year: 2026, month: 9 });
    expect(payrollMonthKey(FILTERS)).toBe('2026-09');
    expect(payrollMonthKey({ year: 2027, month: 1 })).toBe('2027-01');
  });

  it('offers the previous, current and next year and twelve months', () => {
    expect(payrollYearChoices('2026-09-21')).toEqual([2025, 2026, 2027]);
    expect(payrollYearChoices('bad')).toEqual([]);
    expect(payrollMonthChoices().length).toBe(12);
    expect(payrollMonthLabel(9)).toBe('September');
    expect(payrollMonthLabel(13)).toBe('');
  });

  it('parses the tab and falls back to Monthly', () => {
    expect(parsePayrollTab('daily')).toBe('daily');
    expect(parsePayrollTab('x')).toBe('monthly');
    expect(parsePayrollTab(null)).toBe('monthly');
  });

  it('lists Monthly employees sorted by name and leaves out Inactive ones (AC-24)', () => {
    expect(names(selectPayrollEmployees(EMPLOYEE_SEED, 'monthly', FILTERS))).toEqual([
      'Anura Bandara',
      'Dilani Fernando',
      'Kamal Silva',
      'Nimal Perera',
      'Ruwani Jayawardena',
    ]);
  });

  it('lists only Daily employees on the Daily tab (AC-25)', () => {
    expect(names(selectPayrollEmployees(EMPLOYEE_SEED, 'daily', FILTERS))).toEqual([
      'Suresh Kumar',
      'Tharindu Silva',
    ]);
  });

  it('filters by keyword on name, code and mobile ignoring case (AC-27)', () => {
    const pick = (keyword: string) =>
      names(selectPayrollEmployees(EMPLOYEE_SEED, 'monthly', { ...FILTERS, keyword }));
    expect(pick('KAMAL')).toEqual(['Kamal Silva']);
    expect(pick('emp-003')).toEqual(['Dilani Fernando']);
    expect(pick('77 100 0004')).toEqual(['Ruwani Jayawardena']);
    expect(pick('  silva ')).toEqual(['Kamal Silva']);
    expect(pick('zzz')).toEqual([]);
  });

  it('filters by location and combines with the keyword (AC-28)', () => {
    const pick = (location: string, keyword = '') =>
      selectPayrollEmployees(EMPLOYEE_SEED, 'monthly', { ...FILTERS, location, keyword }).length;
    expect(pick('Main Pharmacy')).toBe(5);
    expect(pick('Nowhere')).toBe(0);
    expect(pick('Main Pharmacy', 'nimal')).toBe(1);
  });

  it('does not modify the source list', () => {
    const before = names(EMPLOYEE_SEED);
    selectPayrollEmployees(EMPLOYEE_SEED, 'monthly', FILTERS);
    expect(names(EMPLOYEE_SEED)).toEqual(before);
  });
});

describe('paginatePayrollRows', () => {
  const rows = Array.from({ length: 25 }, (_, index) => index + 1);

  it('pages by 10 and writes the entries text (AC-33)', () => {
    const page = paginatePayrollRows(rows, 3, 10);
    expect(page.rows).toEqual([21, 22, 23, 24, 25]);
    expect(page.entriesText).toBe('Showing 21 to 25 of 25 entries');
    expect(page.pageCount).toBe(3);
  });

  it('supports 25 and 50 and falls back to 10 for other sizes', () => {
    expect(paginatePayrollRows(rows, 1, 25).rows.length).toBe(25);
    expect(paginatePayrollRows(rows, 1, 50).pageCount).toBe(1);
    expect(paginatePayrollRows(rows, 1, 7).rows.length).toBe(10);
  });

  it('clamps out of range and invalid pages', () => {
    expect(paginatePayrollRows(rows, 99, 10).page).toBe(3);
    expect(paginatePayrollRows(rows, 0, 10).page).toBe(1);
    expect(paginatePayrollRows(rows, Number.NaN, 10).page).toBe(1);
  });

  it('shows 0 to 0 of 0 for no rows', () => {
    const page = paginatePayrollRows([], 1, 10);
    expect(page.entriesText).toBe('Showing 0 to 0 of 0 entries');
    expect(page.pageCount).toBe(1);
    expect(page.rows).toEqual([]);
  });
});
