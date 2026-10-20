import { LeaveRequest } from '../models/domain/leave-request.model';
import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import { LEAVE_REQUEST_SEED, LEAVE_TYPE_SEED } from '../services/data/in-memory/seed/leave.seed';
import {
  buildLeaveListRows,
  buildLeaveStatusChips,
  filterLeaveRows,
  paginateLeaveRows,
  parseLeaveStatusFilter,
  sortLeaveNewestFirst,
} from './leave-list.util';

describe('leave-list.util', () => {
  const rows = buildLeaveListRows(LEAVE_REQUEST_SEED, EMPLOYEE_SEED, LEAVE_TYPE_SEED);

  it('sorts by From date, newest first', () => {
    const from = rows.map(row => row.request.fromDate);
    expect(from).toEqual([...from].sort().reverse());
    expect(rows[0].request.id).toBe('leave-010');
  });

  it('breaks ties by created time then id', () => {
    const base = LEAVE_REQUEST_SEED[0];
    const a: LeaveRequest = { ...base, id: 'a', createdAt: '2026-01-01T00:00:00.000Z' };
    const b: LeaveRequest = { ...base, id: 'b', createdAt: '2026-01-02T00:00:00.000Z' };
    const c: LeaveRequest = { ...base, id: 'c', createdAt: '2026-01-02T00:00:00.000Z' };
    expect(sortLeaveNewestFirst([a, b, c]).map(item => item.id)).toEqual(['c', 'b', 'a']);
  });

  it('shows names for employee, type, approver and covering', () => {
    const row = rows.find(item => item.request.id === 'leave-009')!;
    expect(row.employeeName).toBe('Kamal Silva');
    expect(row.employeeCode).toBe('EMP-002');
    expect(row.leaveTypeName).toBe('Annual Leave');
    expect(row.approverName).toBe('Nimal Perera');
    expect(row.coveringName).toBe('Dilani Fernando');
    expect(rows.find(item => item.request.id === 'leave-001')!.coveringName).toBe('–');
  });

  it('counts each status live for the chips', () => {
    expect(buildLeaveStatusChips(LEAVE_REQUEST_SEED)).toEqual([
      { id: 'all', label: 'All', count: 10 },
      { id: 'PENDING', label: 'Pending', count: 2 },
      { id: 'APPROVED', label: 'Approved', count: 5 },
      { id: 'REJECTED', label: 'Rejected', count: 1 },
      { id: 'CANCELLED', label: 'Cancelled', count: 2 },
    ]);
    expect(buildLeaveStatusChips([]).every(chip => chip.count === 0)).toBeTrue();
  });

  it('filters by status and ignores an unknown status', () => {
    expect(filterLeaveRows(rows, 'PENDING')).toHaveSize(2);
    expect(filterLeaveRows(rows, 'all')).toHaveSize(10);
    expect(parseLeaveStatusFilter('APPROVED')).toBe('APPROVED');
    expect(parseLeaveStatusFilter('bogus')).toBe('all');
    expect(parseLeaveStatusFilter(null)).toBe('all');
  });

  it('filters by employee name or code, case-insensitively, combined with status', () => {
    expect(filterLeaveRows(rows, 'all', 'kamal').map(row => row.employeeName)).toEqual(
      jasmine.arrayContaining(['Kamal Silva'])
    );
    expect(filterLeaveRows(rows, 'all', '  EMP-007 ')).toHaveSize(
      rows.filter(row => row.employeeCode === 'EMP-007').length
    );
    expect(
      filterLeaveRows(rows, 'all', 'emp-007').every(row => row.employeeCode === 'EMP-007')
    ).toBeTrue();
    expect(filterLeaveRows(rows, 'PENDING', 'dilani')).toHaveSize(1);
    expect(filterLeaveRows(rows, 'REJECTED', 'dilani')).toHaveSize(0);
    expect(filterLeaveRows(rows, 'all', 'zzz-nobody')).toHaveSize(0);
    expect(filterLeaveRows(rows, 'all', '   ')).toHaveSize(10);
  });

  it('pages 10, 25 or 50 and clamps bad page and size values', () => {
    const many = Array.from({ length: 27 }, () => rows[0]);
    const first = paginateLeaveRows(many, 1, 10);
    expect(first.rows).toHaveSize(10);
    expect(first.pageCount).toBe(3);
    expect(first.entriesText).toBe('Showing 1 to 10 of 27 entries');
    expect(paginateLeaveRows(many, 99, 10).page).toBe(3);
    expect(paginateLeaveRows(many, Number.NaN, 10).page).toBe(1);
    expect(paginateLeaveRows(many, 1, 7).rows).toHaveSize(10);
    expect(paginateLeaveRows(many, 1, 25).rows).toHaveSize(25);
    expect(paginateLeaveRows([], 1, 10).entriesText).toBe('Showing 0 to 0 of 0 entries');
  });
});
