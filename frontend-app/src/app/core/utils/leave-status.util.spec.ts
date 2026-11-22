import { AppUser } from '../models/domain/app-user.model';
import { LeaveRequest } from '../models/domain/leave-request.model';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import { LEAVE_REQUEST_SEED } from '../services/data/in-memory/seed/leave.seed';
import { USER_SEED } from '../services/data/in-memory/seed/user.seed';
import { LEAVE_TRANSITIONS, canCancelLeave, canDecideLeave } from './leave-status.util';

describe('leave-status.util', () => {
  const today = '2026-09-21';
  const pending: LeaveRequest = {
    ...LEAVE_REQUEST_SEED[1],
    employeeId: 'emp-003',
    approverEmployeeId: 'emp-002',
    status: LeaveStatus.PENDING,
  };
  const user = (id: string): AppUser => USER_SEED.find(item => item.id === id)!;
  const decide = (request: LeaveRequest, userId: string | null, canOpen = true) =>
    canDecideLeave(
      request,
      { user: userId === null ? null : user(userId), canOpenEmployees: canOpen },
      EMPLOYEE_SEED,
      USER_SEED
    );

  it('allows Pending to move to any other state and Approved only to Cancelled', () => {
    expect(LEAVE_TRANSITIONS[LeaveStatus.PENDING]).toEqual([
      LeaveStatus.APPROVED,
      LeaveStatus.REJECTED,
      LeaveStatus.CANCELLED,
    ]);
    expect(LEAVE_TRANSITIONS[LeaveStatus.APPROVED]).toEqual([LeaveStatus.CANCELLED]);
    expect(canCancelLeave(pending, today)).toBeTrue();
  });

  it('keeps Rejected and Cancelled final', () => {
    for (const status of [LeaveStatus.REJECTED, LeaveStatus.CANCELLED]) {
      expect(LEAVE_TRANSITIONS[status]).toEqual([]);
      expect(canCancelLeave({ status, fromDate: '2027-01-01' }, today)).toBeFalse();
    }
  });

  it('lets Approved be cancelled only before it starts', () => {
    const approved = (fromDate: string) => ({ status: LeaveStatus.APPROVED, fromDate });
    expect(canCancelLeave(approved('2026-09-22'), today)).toBeTrue();
    expect(canCancelLeave(approved('2026-09-21'), today)).toBeFalse();
    expect(canCancelLeave(approved('2026-09-01'), today)).toBeFalse();
  });

  it("lets an Admin decide any other person's Pending request while Employees is open to them", () => {
    expect(decide(pending, 'usr-001')).toBeTrue();
    expect(decide({ ...pending, approverEmployeeId: 'emp-001' }, 'usr-001')).toBeTrue();
  });

  it('stops an Admin deciding once Employees access is removed', () => {
    expect(decide(pending, 'usr-001', false)).toBeFalse();
  });

  it('lets the linked approver decide when they can open Employees', () => {
    expect(decide(pending, 'usr-002')).toBeTrue();
    expect(decide(pending, 'usr-002', false)).toBeFalse();
  });

  it('refuses a Manager who is not the assigned approver', () => {
    expect(decide({ ...pending, approverEmployeeId: 'emp-001' }, 'usr-002')).toBeFalse();
  });

  it('never lets anyone decide their own request, not even an Admin', () => {
    expect(decide({ ...pending, employeeId: 'emp-002' }, 'usr-002')).toBeFalse();
    expect(decide({ ...pending, employeeId: 'emp-001' }, 'usr-001')).toBeFalse();
  });

  it('refuses a signed-out, disabled or unknown actor and decided requests', () => {
    expect(decide(pending, null)).toBeFalse();
    expect(decide({ ...pending, status: LeaveStatus.APPROVED }, 'usr-001')).toBeFalse();
    const disabled = USER_SEED.map(item =>
      item.id === 'usr-001' ? { ...item, status: UserStatus.DISABLED } : item
    );
    expect(
      canDecideLeave(
        pending,
        { user: user('usr-001'), canOpenEmployees: true },
        EMPLOYEE_SEED,
        disabled
      )
    ).toBeFalse();
    const stranger: AppUser = { ...user('usr-001'), id: 'usr-999' };
    expect(
      canDecideLeave(pending, { user: stranger, canOpenEmployees: true }, EMPLOYEE_SEED, USER_SEED)
    ).toBeFalse();
  });

  it('relies on the Employees permission, not the role, for a linked approver', () => {
    expect(
      decide({ ...pending, approverEmployeeId: 'emp-004', employeeId: 'emp-003' }, 'usr-004')
    ).toBeTrue();
  });
});
