import { Employee } from '../models/domain/employee.model';
import { LeaveRequest } from '../models/domain/leave-request.model';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import {
  coveringLeaveWarning,
  employeeOptionLabel,
  filterCoveringCandidates,
} from './leave-covering.util';

describe('leave-covering.util', () => {
  const employee = (
    id: string,
    code: string,
    name: string,
    status: EmployeeStatus = EmployeeStatus.ACTIVE
  ) => ({ id, code, name, status }) as Employee;
  const employees = [
    employee('e1', 'EMP-001', 'Nimal Perera'),
    employee('e2', 'EMP-002', 'Kamala Silva'),
    employee('e3', 'EMP-003', 'Old Hand', EmployeeStatus.INACTIVE),
  ];
  const request = (status: LeaveStatus, from: string, to: string) =>
    ({ employeeId: 'e2', status, fromDate: from, toDate: to }) as LeaveRequest;

  it('labels with code and name', () => {
    expect(employeeOptionLabel(employees[0])).toBe('EMP-001 - Nimal Perera');
  });

  it('excludes the applicant and inactive employees', () => {
    expect(filterCoveringCandidates(employees, 'e1', '').map(item => item.id)).toEqual(['e2']);
  });

  it('filters by code or name, ignoring case', () => {
    expect(filterCoveringCandidates(employees, '', 'emp-002').map(item => item.id)).toEqual(['e2']);
    expect(filterCoveringCandidates(employees, '', ' PERERA ').map(item => item.id)).toEqual([
      'e1',
    ]);
    expect(filterCoveringCandidates(employees, '', 'zzz')).toEqual([]);
  });

  it('warns when the covering employee has approved leave on those dates', () => {
    const requests = [request(LeaveStatus.APPROVED, '2026-10-05', '2026-10-07')];
    expect(coveringLeaveWarning('e2', '2026-10-07', '2026-10-09', employees, requests)).toContain(
      'Kamala Silva is on approved leave'
    );
  });

  it('does not warn for pending leave, other dates or incomplete input', () => {
    const pending = [request(LeaveStatus.PENDING, '2026-10-05', '2026-10-07')];
    const approved = [request(LeaveStatus.APPROVED, '2026-10-05', '2026-10-07')];
    expect(coveringLeaveWarning('e2', '2026-10-05', '2026-10-07', employees, pending)).toBeNull();
    expect(coveringLeaveWarning('e2', '2026-10-08', '2026-10-09', employees, approved)).toBeNull();
    expect(coveringLeaveWarning('', '2026-10-05', '2026-10-07', employees, approved)).toBeNull();
    expect(coveringLeaveWarning('e2', '2026-10-07', '2026-10-05', employees, approved)).toBeNull();
  });
});
