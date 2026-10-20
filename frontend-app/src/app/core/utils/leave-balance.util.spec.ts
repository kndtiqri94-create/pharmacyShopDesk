import { LeaveRequest } from '../models/domain/leave-request.model';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import {
  LEAVE_ENTITLEMENT_SEED,
  LEAVE_REQUEST_SEED,
  LEAVE_TYPE_SEED,
} from '../services/data/in-memory/seed/leave.seed';
import { balanceFor, buildBalanceRows, formatLeaveDays, roundDays } from './leave-balance.util';

function request(status: LeaveStatus, days: number, from = '2026-05-04'): LeaveRequest {
  return {
    ...LEAVE_REQUEST_SEED[2],
    id: `r-${status}-${days}-${from}`,
    employeeId: 'emp-005',
    leaveTypeId: 'lt-003',
    fromDate: from,
    toDate: from,
    days,
    status,
  };
}

describe('leave-balance.util', () => {
  const entitlements = LEAVE_ENTITLEMENT_SEED;

  it('subtracts Approved as utilized and Pending as pending', () => {
    const requests = [request(LeaveStatus.APPROVED, 2), request(LeaveStatus.PENDING, 1)];
    expect(balanceFor('emp-005', 'lt-003', 2026, entitlements, requests)).toEqual({
      entitlement: 7,
      utilized: 2,
      pending: 1,
      balance: 4,
    });
  });

  it('ignores Rejected and Cancelled requests', () => {
    const requests = [request(LeaveStatus.REJECTED, 3), request(LeaveStatus.CANCELLED, 2)];
    expect(balanceFor('emp-005', 'lt-003', 2026, entitlements, requests).balance).toBe(7);
  });

  it('counts only the chosen year, employee and type', () => {
    const requests = [
      request(LeaveStatus.APPROVED, 2, '2025-05-04'),
      { ...request(LeaveStatus.APPROVED, 2), employeeId: 'emp-001' },
      { ...request(LeaveStatus.APPROVED, 2), leaveTypeId: 'lt-001' },
    ];
    expect(balanceFor('emp-005', 'lt-003', 2026, entitlements, requests).utilized).toBe(0);
  });

  it('gives a zero entitlement for an unknown employee or year', () => {
    expect(balanceFor('x', 'lt-003', 2026, entitlements, []).entitlement).toBe(0);
    expect(balanceFor('emp-005', 'lt-003', 2030, entitlements, []).balance).toBe(0);
  });

  it('builds one row per leave type with the seeded figures', () => {
    const rows = buildBalanceRows(
      'emp-004',
      2026,
      LEAVE_TYPE_SEED,
      entitlements,
      LEAVE_REQUEST_SEED
    );
    expect(rows.map(row => row.leaveTypeName)).toEqual(LEAVE_TYPE_SEED.map(type => type.name));
    const casual = rows.find(row => row.leaveTypeId === 'lt-003')!;
    expect(casual).toEqual(
      jasmine.objectContaining({ entitlement: 7, utilized: 2, pending: 0, balance: 5 })
    );
    expect(rows.find(row => row.leaveTypeId === 'lt-002')?.balance).toBe(0);
  });

  it('shows days with two decimals', () => {
    expect(formatLeaveDays(3)).toBe('3.00');
    expect(formatLeaveDays(0.1 + 0.2)).toBe('0.30');
    expect(roundDays(0.1 + 0.2)).toBe(0.3);
  });
});
