import { Employee } from '../models/domain/employee.model';
import { LeaveRequest } from '../models/domain/leave-request.model';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { datesCoverDay } from './leave-days.util';

function approvedCovering(requests: readonly LeaveRequest[], today: string): LeaveRequest[] {
  return requests.filter(
    request =>
      request.status === LeaveStatus.APPROVED &&
      datesCoverDay(request.fromDate, request.toDate, today)
  );
}

export function onLeaveEmployeeIds(requests: readonly LeaveRequest[], today: string): Set<string> {
  return new Set(approvedCovering(requests, today).map(request => request.employeeId));
}

export function latestReturnDate(
  employeeId: string,
  requests: readonly LeaveRequest[],
  today: string
): string | null {
  const ends = approvedCovering(requests, today)
    .filter(request => request.employeeId === employeeId)
    .map(request => request.toDate)
    .sort();
  return ends[ends.length - 1] ?? null;
}

export function derivedEmployeeStatus(
  employee: Employee,
  onLeaveIds: ReadonlySet<string>
): EmployeeStatus {
  if (employee.status === EmployeeStatus.INACTIVE) return EmployeeStatus.INACTIVE;
  return onLeaveIds.has(employee.id) ? EmployeeStatus.ON_LEAVE : EmployeeStatus.ACTIVE;
}
