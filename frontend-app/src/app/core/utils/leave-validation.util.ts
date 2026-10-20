import { AppUser } from '../models/domain/app-user.model';
import { Employee } from '../models/domain/employee.model';
import { LeaveEntitlement } from '../models/domain/leave-entitlement.model';
import { LeaveRequest } from '../models/domain/leave-request.model';
import { LeaveType } from '../models/domain/leave-type.model';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { LeaveReason } from '../models/enums/leave-reason.enum';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { formatDate, isIsoDate } from './date.util';
import { ImageFileInfo } from './employee-image.util';
import { validateLeaveAttachment } from './leave-attachment.util';
import { balanceFor, formatLeaveDays } from './leave-balance.util';
import {
  countLeaveDays,
  datesOverlap,
  isInsideLeaveYear,
  isValidLeaveYear,
  leavePeriodText,
} from './leave-days.util';

export const LEAVE_COMMENTS_MAX = 250;

const FIELD_ORDER = [
  'employeeId',
  'year',
  'leaveTypeId',
  'fromDate',
  'toDate',
  'attachment',
  'reason',
  'comments',
  'coveringEmployeeId',
  'approverEmployeeId',
] as const;

const BLOCKING_STATUSES: readonly LeaveStatus[] = [LeaveStatus.PENDING, LeaveStatus.APPROVED];
const APPROVER_ROLES: readonly UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];
const LEAVE_REASONS: readonly string[] = Object.values(LeaveReason);

export type LeaveFieldErrors = Record<string, string>;

export interface LeaveFormInput {
  employeeId: string;
  year: number;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  comments: string;
  attachment: ImageFileInfo | null;
  coveringEmployeeId: string;
  approverEmployeeId: string;
}

export interface LeaveValidationContext {
  employees: readonly Employee[];
  users: readonly AppUser[];
  types: readonly LeaveType[];
  entitlements: readonly LeaveEntitlement[];
  requests: readonly LeaveRequest[];
}

export interface ValidatedLeave {
  employeeId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: LeaveReason;
  comments: string;
  attachmentName: string | null;
  coveringEmployeeId: string | null;
  approverEmployeeId: string;
}

export interface LeaveValidationResult {
  errors: LeaveFieldErrors;
  firstErrorField: string | null;
  values: ValidatedLeave | null;
}

export function isActiveEmployee(employee: Employee | undefined): employee is Employee {
  return employee !== undefined && employee.status !== EmployeeStatus.INACTIVE;
}

export function isEligibleApprover(
  employee: Employee | undefined,
  users: readonly AppUser[]
): boolean {
  if (!isActiveEmployee(employee) || employee.userId === null) return false;
  const user = users.find(candidate => candidate.id === employee.userId);
  return (
    user !== undefined && user.status === UserStatus.ACTIVE && APPROVER_ROLES.includes(user.role)
  );
}

export function isLeaveTypeSelectable(
  employeeId: string,
  leaveTypeId: string,
  year: number,
  context: Pick<LeaveValidationContext, 'entitlements' | 'requests'>
): boolean {
  return (
    balanceFor(employeeId, leaveTypeId, year, context.entitlements, context.requests).balance > 0
  );
}

function checkEmployee(
  errors: LeaveFieldErrors,
  input: LeaveFormInput,
  context: LeaveValidationContext
): void {
  if (input.employeeId === '') {
    errors['employeeId'] = 'Employee is required';
  } else if (!isActiveEmployee(context.employees.find(item => item.id === input.employeeId))) {
    errors['employeeId'] = 'Choose an active employee';
  }
  if (!isValidLeaveYear(input.year)) errors['year'] = 'Choose a valid leave year';
}

function checkDates(errors: LeaveFieldErrors, input: LeaveFormInput): boolean {
  if (input.fromDate === '') errors['fromDate'] = 'From date is required';
  else if (!isIsoDate(input.fromDate)) errors['fromDate'] = 'Enter a real From date';
  if (input.toDate === '') errors['toDate'] = 'To date is required';
  else if (!isIsoDate(input.toDate)) errors['toDate'] = 'Enter a real To date';
  if (errors['fromDate'] !== undefined || errors['toDate'] !== undefined) return false;
  if (input.toDate < input.fromDate) {
    errors['toDate'] = 'To date cannot be before From date';
    return false;
  }
  if (!isValidLeaveYear(input.year)) return false;
  const period = leavePeriodText(input.year);
  if (!isInsideLeaveYear(input.fromDate, input.year)) {
    errors['fromDate'] = `From date must be within ${period}`;
  } else if (!isInsideLeaveYear(input.toDate, input.year)) {
    errors['toDate'] = `To date must be within ${period}`;
  }
  return errors['fromDate'] === undefined && errors['toDate'] === undefined;
}

function checkOverlap(
  errors: LeaveFieldErrors,
  input: LeaveFormInput,
  context: LeaveValidationContext
): void {
  const clash = context.requests.find(
    request =>
      request.employeeId === input.employeeId &&
      BLOCKING_STATUSES.includes(request.status) &&
      datesOverlap(input.fromDate, input.toDate, request.fromDate, request.toDate)
  );
  if (clash !== undefined) {
    errors['fromDate'] =
      `Overlaps leave from ${formatDate(clash.fromDate)} to ${formatDate(clash.toDate)}`;
  }
}

function checkLeaveType(
  errors: LeaveFieldErrors,
  input: LeaveFormInput,
  context: LeaveValidationContext,
  datesOk: boolean
): void {
  if (input.leaveTypeId === '') {
    errors['leaveTypeId'] = 'Leave type is required';
    return;
  }
  const type = context.types.find(item => item.id === input.leaveTypeId);
  if (type === undefined) {
    errors['leaveTypeId'] = 'Choose a listed leave type';
    return;
  }
  const { balance } = balanceFor(
    input.employeeId,
    type.id,
    input.year,
    context.entitlements,
    context.requests
  );
  if (balance <= 0) {
    errors['leaveTypeId'] = `${type.name} has no balance left`;
    return;
  }
  const days = datesOk ? countLeaveDays(input.fromDate, input.toDate) : Number.NaN;
  if (!Number.isNaN(days) && days > balance && errors['toDate'] === undefined) {
    errors['toDate'] = `Only ${formatLeaveDays(balance)} days of ${type.name} left`;
  }
}

function checkOptionalFields(
  errors: LeaveFieldErrors,
  input: LeaveFormInput,
  context: LeaveValidationContext
): void {
  if (!LEAVE_REASONS.includes(input.reason)) errors['reason'] = 'Reason is required';
  if (input.comments.trim().length > LEAVE_COMMENTS_MAX) {
    errors['comments'] = `Comments must be ${LEAVE_COMMENTS_MAX} characters or fewer`;
  }
  if (input.attachment !== null) {
    const problem = validateLeaveAttachment(input.attachment);
    if (problem !== null) errors['attachment'] = problem;
  }
  if (input.coveringEmployeeId !== '') {
    const covering = context.employees.find(item => item.id === input.coveringEmployeeId);
    if (input.coveringEmployeeId === input.employeeId) {
      errors['coveringEmployeeId'] = 'Covering employee cannot be the applicant';
    } else if (!isActiveEmployee(covering)) {
      errors['coveringEmployeeId'] = 'Choose an active covering employee';
    }
  }
  if (input.approverEmployeeId === '') {
    errors['approverEmployeeId'] = 'Approver is required';
  } else if (input.approverEmployeeId === input.employeeId) {
    errors['approverEmployeeId'] = 'Approver cannot be the applicant';
  } else {
    const approver = context.employees.find(item => item.id === input.approverEmployeeId);
    if (!isEligibleApprover(approver, context.users)) {
      errors['approverEmployeeId'] = 'Choose an active Admin or Manager as approver';
    }
  }
}

export function validateLeave(
  input: LeaveFormInput,
  context: LeaveValidationContext
): LeaveValidationResult {
  const errors: LeaveFieldErrors = {};
  checkEmployee(errors, input, context);
  const datesOk = checkDates(errors, input);
  if (datesOk && errors['employeeId'] === undefined) checkOverlap(errors, input, context);
  checkLeaveType(errors, input, context, datesOk && errors['fromDate'] === undefined);
  checkOptionalFields(errors, input, context);
  const firstErrorField = FIELD_ORDER.find(key => errors[key] !== undefined) ?? null;
  if (firstErrorField !== null) return { errors, firstErrorField, values: null };
  return {
    errors,
    firstErrorField: null,
    values: {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      days: countLeaveDays(input.fromDate, input.toDate),
      reason: input.reason as LeaveReason,
      comments: input.comments.trim(),
      attachmentName: input.attachment === null ? null : input.attachment.name,
      coveringEmployeeId: input.coveringEmployeeId === '' ? null : input.coveringEmployeeId,
      approverEmployeeId: input.approverEmployeeId,
    },
  };
}
