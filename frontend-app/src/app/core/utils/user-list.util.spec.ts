import { AppUser } from '../models/domain/app-user.model';
import { UserStatus } from '../models/enums/user-status.enum';
import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import { USER_SEED } from '../services/data/in-memory/seed/user.seed';
import {
  buildUserRows,
  countActiveUsers,
  formatActiveUsers,
  formatLastSignIn,
  formatUserSubline,
} from './user-list.util';

describe('user-list.util', () => {
  it('joins each user with their employee ID, or none', () => {
    const rows = buildUserRows(USER_SEED, EMPLOYEE_SEED);
    expect(rows[0].employeeCode).toBe('EMP-001');
    expect(formatUserSubline(rows[0])).toBe('nimal · EMP-001');
    const orphan: AppUser = {
      ...USER_SEED[0],
      id: 'usr-009',
      username: 'cashier2',
      employeeId: null,
    };
    const row = buildUserRows([orphan], EMPLOYEE_SEED)[0];
    expect(formatUserSubline(row)).toBe('cashier2 · no employee');
  });

  it('counts only active users', () => {
    const users = USER_SEED.map(user =>
      user.id === 'usr-004' ? { ...user, status: UserStatus.DISABLED } : user
    );
    expect(countActiveUsers(USER_SEED)).toBe(4);
    expect(countActiveUsers(users)).toBe(3);
    expect(formatActiveUsers(users)).toBe('3 active users');
    expect(formatActiveUsers(users.slice(0, 1))).toBe('1 active user');
  });

  it('words the last sign-in, including a user who has never signed in', () => {
    expect(formatLastSignIn('2026-09-21T08:40:00')).toBe('21 Sep 2026 · 08:40');
    expect(formatLastSignIn('')).toBe('No sign-in yet');
  });
});
