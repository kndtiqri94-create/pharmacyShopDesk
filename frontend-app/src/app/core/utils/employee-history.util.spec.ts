import { AppUser } from '../models/domain/app-user.model';
import { UserRole } from '../models/enums/user-role.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import { hasHistory, hasLinkedUser } from './employee-history.util';

const USER: AppUser = {
  id: 'usr-x',
  username: 'x',
  displayName: 'X',
  initials: 'X',
  role: UserRole.CASHIER,
  employeeId: 'emp-004',
  status: UserStatus.ACTIVE,
  lastSignIn: '',
};

describe('employee history', () => {
  const linked = EMPLOYEE_SEED.find(employee => employee.userId !== null)!;
  const unlinked = EMPLOYEE_SEED.find(employee => employee.id === 'emp-008')!;

  it('has history when the employee points at a user', () => {
    expect(hasHistory(linked, [])).toBeTrue();
    expect(hasLinkedUser(linked, [])).toBeTrue();
  });

  it('has history when a user points at the employee', () => {
    const employee = { ...unlinked, id: 'emp-004', userId: null };
    expect(hasHistory(employee, [USER])).toBeTrue();
  });

  it('has no history without a user or payroll', () => {
    expect(hasHistory({ ...unlinked, userId: null }, [USER])).toBeFalse();
  });

  it('counts payroll history when it is supplied', () => {
    const employee = { ...unlinked, userId: null };
    expect(hasHistory(employee, [], [employee.id])).toBeTrue();
    expect(hasHistory(employee, [], ['other'])).toBeFalse();
  });
});
