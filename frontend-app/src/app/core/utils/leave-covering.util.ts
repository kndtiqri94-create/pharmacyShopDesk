import { Employee } from '../models/domain/employee.model';
import { LeaveRequest } from '../models/domain/leave-request.model';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { datesOverlap } from './leave-days.util';
import { isActiveEmployee } from './leave-validation.util';

export function employeeOptionLabel(employee: Employee): string {
  return `${employee.code} - ${employee.name}`;
}

export function filterCoveringCandidates(
  employees: readonly Employee[],
  applicantId: string,
  term: string
): Employee[] {
  const needle = term.trim().toLowerCase();
  return employees.filter(
    employee =>
      isActiveEmployee(employee) &&
      employee.id !== applicantId &&
      (needle === '' ||
        employee.code.toLowerCase().includes(needle) ||
        employee.name.toLowerCase().includes(needle))
  );
}

export function coveringLeaveWarning(
  coveringId: string,
  fromDate: string,
  toDate: string,
  employees: readonly Employee[],
  requests: readonly LeaveRequest[]
): string | null {
  if (coveringId === '' || fromDate === '' || toDate === '' || toDate < fromDate) return null;
  const clash = requests.some(
    request =>
      request.employeeId === coveringId &&
      request.status === LeaveStatus.APPROVED &&
      datesOverlap(fromDate, toDate, request.fromDate, request.toDate)
  );
  if (!clash) return null;
  const name = employees.find(employee => employee.id === coveringId)?.name ?? 'This employee';
  return `${name} is on approved leave on some of these dates. You can still choose them.`;
}
