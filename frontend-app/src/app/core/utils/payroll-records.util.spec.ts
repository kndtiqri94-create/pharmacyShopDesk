import { LeaveRequest } from '../models/domain/leave-request.model';
import { SalaryAdvance } from '../models/domain/salary-advance.model';
import { LeaveReason } from '../models/enums/leave-reason.enum';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { selectPayrollRecords } from './payroll-records.util';

const TYPES = [{ id: 'lt-003', name: 'Casual Leave' }];

function advance(id: string, employeeId: string, date: string): SalaryAdvance {
  return { id, employeeId, counter: 'Counter1', date, amountCents: 1000, createdAt: '' };
}

function leave(
  id: string,
  from: string,
  to: string,
  status: LeaveStatus = LeaveStatus.APPROVED,
  employeeId = 'emp-004'
): LeaveRequest {
  return {
    id,
    employeeId,
    leaveTypeId: 'lt-003',
    fromDate: from,
    toDate: to,
    days: 1,
    reason: LeaveReason.OTHER,
    comments: '',
    attachmentName: null,
    coveringEmployeeId: null,
    approverEmployeeId: 'emp-002',
    approverComment: '',
    status,
    createdAt: '',
    decidedAt: null,
  };
}

describe('selectPayrollRecords', () => {
  it('lists only that employee and month advances, oldest first', () => {
    const result = selectPayrollRecords(
      'emp-004',
      '2026-09',
      [
        advance('b', 'emp-004', '2026-09-20'),
        advance('a', 'emp-004', '2026-09-02'),
        advance('c', 'emp-004', '2026-08-30'),
        advance('d', 'emp-005', '2026-09-05'),
      ],
      [],
      TYPES
    );
    expect(result.advances.map(item => item.id)).toEqual(['a', 'b']);
  });

  it('lists approved leave overlapping the month with the days that fall inside it', () => {
    const result = selectPayrollRecords(
      'emp-004',
      '2026-09',
      [],
      [
        leave('x', '2026-08-30', '2026-09-02'),
        leave('y', '2026-09-10', '2026-09-10'),
        leave('pending', '2026-09-12', '2026-09-12', LeaveStatus.PENDING),
        leave('other', '2026-09-14', '2026-09-14', LeaveStatus.APPROVED, 'emp-005'),
        leave('away', '2026-10-05', '2026-10-06'),
      ],
      TYPES
    );
    expect(result.leaves.map(item => [item.id, item.daysInMonth, item.leaveTypeName])).toEqual([
      ['x', 2, 'Casual Leave'],
      ['y', 1, 'Casual Leave'],
    ]);
  });

  it('gives nothing for an invalid month', () => {
    expect(
      selectPayrollRecords('emp-004', 'bad', [], [leave('x', '2026-09-01', '2026-09-01')], TYPES)
    ).toEqual({ advances: [], leaves: [] });
  });
});
