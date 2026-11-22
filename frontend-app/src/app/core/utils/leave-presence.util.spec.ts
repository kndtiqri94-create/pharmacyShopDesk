import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import { LEAVE_REQUEST_SEED } from '../services/data/in-memory/seed/leave.seed';
import { derivedEmployeeStatus, latestReturnDate, onLeaveEmployeeIds } from './leave-presence.util';

describe('leave-presence.util', () => {
  const requests = LEAVE_REQUEST_SEED;

  it('is on leave from the first to the last day of an Approved request', () => {
    const away = (day: string) => onLeaveEmployeeIds(requests, day).has('emp-007');
    expect(away('2026-09-18')).toBeFalse();
    expect(away('2026-09-19')).toBeTrue();
    expect(away('2026-09-24')).toBeTrue();
    expect(away('2026-09-25')).toBeFalse();
  });

  it('ignores Pending, Rejected and Cancelled requests', () => {
    expect(onLeaveEmployeeIds(requests, '2026-10-13').has('emp-003')).toBeFalse();
    expect(onLeaveEmployeeIds(requests, '2026-06-16').has('emp-005')).toBeFalse();
    expect(onLeaveEmployeeIds(requests, '2026-07-20').has('emp-006')).toBeFalse();
  });

  it('lists everyone away on a day', () => {
    expect([...onLeaveEmployeeIds(requests, '2026-09-21')]).toEqual(['emp-007']);
    expect(onLeaveEmployeeIds([], '2026-09-21').size).toBe(0);
  });

  it('finds the latest end date of the leave covering today', () => {
    expect(latestReturnDate('emp-007', requests, '2026-09-21')).toBe('2026-09-24');
    const longer = [
      ...requests,
      { ...requests[0], id: 'x', fromDate: '2026-09-20', toDate: '2026-09-30', days: 11 },
      { ...requests[0], id: 'y', toDate: '2026-10-30', status: LeaveStatus.PENDING },
    ];
    expect(latestReturnDate('emp-007', longer, '2026-09-21')).toBe('2026-09-30');
    expect(latestReturnDate('emp-001', requests, '2026-09-21')).toBeNull();
  });

  it('derives On leave only for a non-Inactive employee who is away', () => {
    const away = new Set(['emp-007', 'emp-008']);
    const find = (id: string) => EMPLOYEE_SEED.find(employee => employee.id === id)!;
    expect(derivedEmployeeStatus(find('emp-007'), away)).toBe(EmployeeStatus.ON_LEAVE);
    expect(derivedEmployeeStatus(find('emp-008'), away)).toBe(EmployeeStatus.INACTIVE);
    expect(derivedEmployeeStatus(find('emp-007'), new Set())).toBe(EmployeeStatus.ACTIVE);
    expect(derivedEmployeeStatus(find('emp-001'), away)).toBe(EmployeeStatus.ACTIVE);
  });
});
