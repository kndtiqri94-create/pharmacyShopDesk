import { AppUser } from '../models/domain/app-user.model';
import { Employee } from '../models/domain/employee.model';
import { UserStatus } from '../models/enums/user-status.enum';
import { formatDate, formatTime } from './date.util';
import { pluralize } from './text.util';

export const NO_SIGN_IN_LABEL = 'No sign-in yet';
export const NO_EMPLOYEE_LABEL = 'no employee';

export interface UserRow {
  user: AppUser;
  employeeCode: string | null;
}

export function buildUserRows(
  users: readonly AppUser[],
  employees: readonly Employee[]
): UserRow[] {
  return users.map(user => ({
    user,
    employeeCode: employees.find(employee => employee.id === user.employeeId)?.code ?? null,
  }));
}

export function countActiveUsers(users: readonly AppUser[]): number {
  return users.filter(user => user.status === UserStatus.ACTIVE).length;
}

export function formatActiveUsers(users: readonly AppUser[]): string {
  return `${pluralize(countActiveUsers(users), 'active user')}`;
}

export function formatLastSignIn(lastSignIn: string): string {
  if (lastSignIn === '') return NO_SIGN_IN_LABEL;
  return `${formatDate(lastSignIn)} · ${formatTime(lastSignIn)}`;
}

export function formatUserSubline(row: UserRow): string {
  return `${row.user.username} · ${row.employeeCode ?? NO_EMPLOYEE_LABEL}`;
}
