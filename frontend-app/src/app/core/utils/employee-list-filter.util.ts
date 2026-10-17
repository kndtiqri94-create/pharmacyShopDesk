import { AppUser } from '../models/domain/app-user.model';
import { AttendanceRecord } from '../models/domain/attendance-record.model';
import { Employee } from '../models/domain/employee.model';
import { LeaveRecord } from '../models/domain/leave-record.model';
import { AttendanceStatus } from '../models/enums/attendance-status.enum';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { formatDayMonth } from './date.util';
import { normalizeSearch } from './product-list-filter.util';
import { pluralize } from './text.util';
import { formatUserRoleLabel } from './user-role-label.util';

export { SEARCH_MAX_LENGTH } from './product-list-filter.util';

export const NO_LOGIN_LABEL = 'No login';
export const FULL_TIME = 'Full-time';
export const PART_TIME = 'Part-time';

export type EmployeeFilter = 'all' | 'active' | 'on-leave';

export interface EmployeeLogin {
  role: UserRole | null;
  label: string;
  disabled: boolean;
}

export interface EmployeeListItem {
  employee: Employee;
  login: EmployeeLogin;
}

export interface EmployeeListCriteria {
  search: string;
  filter: EmployeeFilter;
}

export type EmployeeFilterCounts = Record<EmployeeFilter, number>;

export interface AttendanceRow {
  employee: Employee;
  status: AttendanceStatus;
  timeIn: string | null;
}

export interface LeaveRow {
  employee: Employee;
  returnDate: string | null;
}

export interface EmployeeSummary {
  total: number;
  fullTime: number;
  partTime: number;
  onShift: number;
  late: number;
  onLeave: number;
  earliestReturn: string | null;
  canLogIn: number;
}

const EMPLOYEE_FILTERS: readonly EmployeeFilter[] = ['all', 'active', 'on-leave'];

const FILTER_TO_STATUS: Record<Exclude<EmployeeFilter, 'all'>, EmployeeStatus> = {
  active: EmployeeStatus.ACTIVE,
  'on-leave': EmployeeStatus.ON_LEAVE,
};

export function parseEmployeeFilter(value: string): EmployeeFilter {
  return EMPLOYEE_FILTERS.find(filter => filter === value) ?? 'all';
}

export function employeeLogin(employee: Employee, users: readonly AppUser[]): EmployeeLogin {
  const user = users.find(candidate => candidate.id === employee.userId);
  if (user === undefined) return { role: null, label: NO_LOGIN_LABEL, disabled: false };
  return {
    role: user.role,
    label: formatUserRoleLabel(user.role),
    disabled: user.status === UserStatus.DISABLED,
  };
}

export function toEmployeeListItems(
  employees: readonly Employee[],
  users: readonly AppUser[]
): EmployeeListItem[] {
  return employees.map(employee => ({ employee, login: employeeLogin(employee, users) }));
}

function matchesSearch(item: EmployeeListItem, term: string): boolean {
  if (term.length === 0) return true;
  const { name, code, phone } = item.employee;
  return [name, code, phone].some(field => field.toLowerCase().includes(term));
}

function matchesFilter(item: EmployeeListItem, filter: EmployeeFilter): boolean {
  return filter === 'all' || item.employee.status === FILTER_TO_STATUS[filter];
}

export function filterEmployeeItems(
  items: readonly EmployeeListItem[],
  criteria: EmployeeListCriteria
): EmployeeListItem[] {
  const term = normalizeSearch(criteria.search);
  return items.filter(item => matchesSearch(item, term) && matchesFilter(item, criteria.filter));
}

export function countEmployeeFilters(
  items: readonly EmployeeListItem[],
  search: string
): EmployeeFilterCounts {
  const scoped = filterEmployeeItems(items, { search, filter: 'all' });
  const countOf = (status: EmployeeStatus) =>
    scoped.filter(item => item.employee.status === status).length;
  return {
    all: scoped.length,
    active: countOf(EmployeeStatus.ACTIVE),
    'on-leave': countOf(EmployeeStatus.ON_LEAVE),
  };
}

function fallbackAttendance(employee: Employee): AttendanceStatus {
  return employee.status === EmployeeStatus.ON_LEAVE
    ? AttendanceStatus.ON_LEAVE
    : AttendanceStatus.NOT_YET;
}

export function buildAttendanceRows(
  employees: readonly Employee[],
  records: readonly AttendanceRecord[]
): AttendanceRow[] {
  return employees.map(employee => {
    const record = records.find(candidate => candidate.employeeId === employee.id);
    return {
      employee,
      status: record?.status ?? fallbackAttendance(employee),
      timeIn: record?.timeIn ?? null,
    };
  });
}

export function buildLeaveRows(
  employees: readonly Employee[],
  leaves: readonly LeaveRecord[]
): LeaveRow[] {
  return employees
    .filter(employee => employee.status === EmployeeStatus.ON_LEAVE)
    .map(employee => ({
      employee,
      returnDate: leaves.find(leave => leave.employeeId === employee.id)?.returnDate ?? null,
    }));
}

export function summarizeEmployees(
  employees: readonly Employee[],
  users: readonly AppUser[],
  attendance: readonly AttendanceRow[],
  leave: readonly LeaveRow[]
): EmployeeSummary {
  const returnDates = leave.map(row => row.returnDate).filter(date => date !== null);
  returnDates.sort();
  const late = attendance.filter(row => row.status === AttendanceStatus.LATE).length;
  const present = attendance.filter(row => row.status === AttendanceStatus.PRESENT).length;
  return {
    total: employees.length,
    fullTime: employees.filter(employee => employee.employmentType === FULL_TIME).length,
    partTime: employees.filter(employee => employee.employmentType === PART_TIME).length,
    onShift: present + late,
    late,
    onLeave: leave.length,
    earliestReturn: returnDates[0] ?? null,
    canLogIn: employees.filter(employee => {
      const login = employeeLogin(employee, users);
      return login.role !== null && !login.disabled;
    }).length,
  };
}

export function formatTimeIn(timeIn: string | null): string {
  return timeIn === null ? '–' : `In ${timeIn}`;
}

export function formatLoginBadge(login: EmployeeLogin): string {
  return login.disabled ? `${login.label} · Disabled` : login.label;
}

export function formatEmployeeSubtitle(summary: EmployeeSummary): string {
  return `${summary.total} staff · ${summary.onShift} on shift today`;
}

export function formatLateNote(late: number): string {
  return late === 0 ? 'Nobody late this morning' : `${late} late this morning`;
}

export function formatLeaveNote(summary: EmployeeSummary): string {
  if (summary.onLeave === 0) return 'Everyone is in';
  return summary.earliestReturn === null
    ? pluralize(summary.onLeave, 'person', 'people') + ' away'
    : `Back on ${formatDayMonth(summary.earliestReturn)}`;
}

export function formatLoginNote(summary: EmployeeSummary): string {
  return summary.canLogIn >= summary.total
    ? 'Everyone has system access'
    : 'Others have no system access';
}
