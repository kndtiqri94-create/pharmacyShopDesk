import { AppUser } from '../models/domain/app-user.model';
import { Employee } from '../models/domain/employee.model';
import { LeaveRequest } from '../models/domain/leave-request.model';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { UserStatus } from '../models/enums/user-status.enum';

export interface LeaveActor {
  user: AppUser | null;
  canOpenEmployees: boolean;
}

export const LEAVE_TRANSITIONS: Readonly<Record<LeaveStatus, readonly LeaveStatus[]>> = {
  PENDING: [LeaveStatus.APPROVED, LeaveStatus.REJECTED, LeaveStatus.CANCELLED],
  APPROVED: [LeaveStatus.CANCELLED],
  REJECTED: [],
  CANCELLED: [],
};

function canTransitionLeave(
  request: Pick<LeaveRequest, 'status' | 'fromDate'>,
  target: LeaveStatus,
  today: string
): boolean {
  if (!LEAVE_TRANSITIONS[request.status].includes(target)) return false;
  const startedApproved =
    request.status === LeaveStatus.APPROVED &&
    target === LeaveStatus.CANCELLED &&
    request.fromDate <= today;
  return !startedApproved;
}

export function canCancelLeave(
  request: Pick<LeaveRequest, 'status' | 'fromDate'>,
  today: string
): boolean {
  return canTransitionLeave(request, LeaveStatus.CANCELLED, today);
}

export function canDecideLeave(
  request: Pick<LeaveRequest, 'status' | 'employeeId' | 'approverEmployeeId'>,
  actor: LeaveActor,
  employees: readonly Employee[],
  users: readonly AppUser[]
): boolean {
  if (request.status !== LeaveStatus.PENDING || actor.user === null) return false;
  const actorId = actor.user.id;
  const known = users.find(candidate => candidate.id === actorId);
  if (known === undefined || known.status !== UserStatus.ACTIVE) return false;
  if (known.employeeId !== null && known.employeeId === request.employeeId) return false;
  if (!actor.canOpenEmployees) return false;
  if (known.role === UserRole.ADMIN) return true;
  if (known.employeeId !== request.approverEmployeeId) return false;
  const approver = employees.find(employee => employee.id === request.approverEmployeeId);
  return approver !== undefined && approver.userId === known.id;
}
