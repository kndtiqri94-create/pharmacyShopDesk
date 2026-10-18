import { AppUser } from '../models/domain/app-user.model';
import { AttendanceRecord } from '../models/domain/attendance-record.model';
import { Employee } from '../models/domain/employee.model';
import { LeaveRecord } from '../models/domain/leave-record.model';
import { AttendanceStatus } from '../models/enums/attendance-status.enum';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { formatDayMonth } from './date.util';
import { pluralize } from './text.util';
import { formatUserRoleLabel } from './user-role-label.util';

const NO_LOGIN_LABEL = 'No login';
export const FULL_TIME = 'Full-time';
export const PART_TIME = 'Part-time';

export interface EmployeeLogin {
  role: UserRole | null;
  label: string;
  disabled: boolean;
}

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

export function employeeLogin(employee: Employee, users: readonly AppUser[]): EmployeeLogin {
  const user = users.find(candidate => candidate.id === employee.userId);
  if (user === undefined) return { role: null, label: NO_LOGIN_LABEL, disabled: false };
  return {
    role: user.role,
    label: formatUserRoleLabel(user.role),
    disabled: user.status === UserStatus.DISABLED,
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
  return employees
    .filter(employee => employee.status !== EmployeeStatus.INACTIVE)
    .map(employee => {
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
