import { Employee } from '../models/domain/employee.model';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { normalizeSearch } from './product-list-filter.util';

export const EMPLOYEE_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_EMPLOYEE_PAGE_SIZE = 10;

export type EmployeeStatusFilter = 'all' | 'active' | 'inactive';

export interface EmployeeTableCriteria {
  keyword: string;
  location: string;
  createdFrom: string;
  createdTo: string;
  status: EmployeeStatusFilter;
}

export interface EmployeePage {
  rows: Employee[];
  page: number;
  pageCount: number;
  total: number;
  entriesText: string;
}

const STATUS_FILTER_TO_STATUS: Record<Exclude<EmployeeStatusFilter, 'all'>, EmployeeStatus> = {
  active: EmployeeStatus.ACTIVE,
  inactive: EmployeeStatus.INACTIVE,
};

export function defaultEmployeeCriteria(): EmployeeTableCriteria {
  return { keyword: '', location: '', createdFrom: '', createdTo: '', status: 'all' };
}

export function parseEmployeeStatusFilter(value: string | null): EmployeeStatusFilter {
  return value === 'active' || value === 'inactive' ? value : 'all';
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseCreatedDate(value: string): string {
  return ISO_DAY.test(value) ? value : '';
}

export function parseEmployeePageSize(value: number): number {
  return (EMPLOYEE_PAGE_SIZES as readonly number[]).includes(value)
    ? value
    : DEFAULT_EMPLOYEE_PAGE_SIZE;
}

export function employeeFullName(
  parts: Pick<Employee, 'firstName' | 'middleName' | 'lastName'>
): string {
  return [parts.firstName, parts.middleName, parts.lastName]
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .join(' ');
}

export function employeeAddressLine(
  employee: Pick<
    Employee,
    'addressLine1' | 'addressLine2' | 'city' | 'suburb' | 'state' | 'country' | 'zip'
  >
): string {
  return [
    employee.addressLine1,
    employee.addressLine2,
    employee.suburb,
    employee.city,
    employee.state,
    employee.country,
    employee.zip,
  ]
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .join(', ');
}

function matchesKeyword(employee: Employee, term: string): boolean {
  if (term.length === 0) return true;
  return [employee.code, employee.name, employeeFullName(employee), employee.phone, employee.email]
    .map(field => field.toLowerCase())
    .some(field => field.includes(term));
}

function matchesCreatedRange(employee: Employee, from: string, to: string): boolean {
  const day = employee.createdAt.slice(0, 10);
  return (from === '' || day >= from) && (to === '' || day <= to);
}

export function filterEmployees(
  employees: readonly Employee[],
  criteria: EmployeeTableCriteria
): Employee[] {
  const term = normalizeSearch(criteria.keyword);
  return employees.filter(
    employee =>
      matchesKeyword(employee, term) &&
      (criteria.location === '' || employee.location === criteria.location) &&
      matchesCreatedRange(employee, criteria.createdFrom, criteria.createdTo) &&
      (criteria.status === 'all' || employee.status === STATUS_FILTER_TO_STATUS[criteria.status])
  );
}

export function sortNewestFirst(employees: readonly Employee[]): Employee[] {
  return [...employees].sort((a, b) =>
    a.createdAt === b.createdAt ? 0 : a.createdAt < b.createdAt ? 1 : -1
  );
}

export function listLocations(employees: readonly Employee[]): string[] {
  return Array.from(new Set(employees.map(employee => employee.location)))
    .filter(location => location.length > 0)
    .sort();
}

export function pageCountOf(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function formatEntriesText(page: number, pageSize: number, total: number): string {
  if (total === 0) return 'Showing 0 to 0 of 0 entries';
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return `Showing ${from} to ${to} of ${total} entries`;
}

export function paginateEmployees(
  employees: readonly Employee[],
  requestedPage: number,
  requestedPageSize: number
): EmployeePage {
  const pageSize = parseEmployeePageSize(requestedPageSize);
  const total = employees.length;
  const pageCount = pageCountOf(total, pageSize);
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pageCount);
  return {
    rows: employees.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount,
    total,
    entriesText: formatEntriesText(page, pageSize, total),
  };
}

export function buildEmployeeList(
  employees: readonly Employee[],
  criteria: EmployeeTableCriteria
): Employee[] {
  return sortNewestFirst(filterEmployees(employees, criteria));
}
