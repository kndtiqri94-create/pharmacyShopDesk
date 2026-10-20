import { Employee } from '../models/domain/employee.model';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { SalaryType } from '../models/enums/salary-type.enum';
import { formatEntriesText, pageCountOf, parseEmployeePageSize } from './employee-list.util';
import { normalizeSearch } from './product-list-filter.util';

export type PayrollTab = 'monthly' | 'daily';

export interface PayrollFilters {
  keyword: string;
  location: string;
  year: number;
  month: number;
}

export interface PayrollPage<T> {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  entriesText: string;
}

export interface PayrollMonthChoice {
  value: number;
  label: string;
}

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const YEAR_SPAN = 1;

export function defaultPayrollFilters(today: string): PayrollFilters {
  return {
    keyword: '',
    location: '',
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  };
}

export function parsePayrollTab(value: string | null): PayrollTab {
  return value === 'daily' ? 'daily' : 'monthly';
}

export function payrollMonthKey(filters: Pick<PayrollFilters, 'year' | 'month'>): string {
  return `${filters.year}-${String(filters.month).padStart(2, '0')}`;
}

export function payrollYearChoices(today: string): number[] {
  const current = Number(today.slice(0, 4));
  if (!Number.isInteger(current)) return [];
  return [current - YEAR_SPAN, current, current + YEAR_SPAN];
}

export function payrollMonthChoices(): PayrollMonthChoice[] {
  return MONTH_LABELS.map((label, index) => ({ value: index + 1, label }));
}

export function payrollMonthLabel(month: number): string {
  return MONTH_LABELS[month - 1] ?? '';
}

function matchesKeyword(employee: Employee, term: string): boolean {
  if (term.length === 0) return true;
  return [employee.name, employee.code, employee.phone].some(field =>
    field.toLowerCase().includes(term)
  );
}

export function selectPayrollEmployees(
  employees: readonly Employee[],
  tab: PayrollTab,
  filters: PayrollFilters
): Employee[] {
  const term = normalizeSearch(filters.keyword);
  const wantedType = tab === 'daily' ? SalaryType.DAILY : SalaryType.MONTHLY;
  return employees
    .filter(
      employee =>
        employee.status !== EmployeeStatus.INACTIVE &&
        employee.salaryType === wantedType &&
        matchesKeyword(employee, term) &&
        (filters.location === '' || employee.location === filters.location)
    )
    .sort(
      (first, second) =>
        first.name.localeCompare(second.name) || first.code.localeCompare(second.code)
    );
}

export function paginatePayrollRows<T>(
  rows: readonly T[],
  requestedPage: number,
  requestedPageSize: number
): PayrollPage<T> {
  const pageSize = parseEmployeePageSize(requestedPageSize);
  const total = rows.length;
  const pageCount = pageCountOf(total, pageSize);
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pageCount);
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount,
    total,
    entriesText: formatEntriesText(page, pageSize, total),
  };
}
