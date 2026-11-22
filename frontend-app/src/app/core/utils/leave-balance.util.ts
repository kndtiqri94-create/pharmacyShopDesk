import { LeaveEntitlement } from '../models/domain/leave-entitlement.model';
import { LeaveRequest } from '../models/domain/leave-request.model';
import { LeaveType } from '../models/domain/leave-type.model';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { yearOfDate } from './leave-days.util';

const DAY_DECIMALS = 2;
const ROUNDING_FACTOR = 10 ** DAY_DECIMALS;

export interface LeaveBalance {
  entitlement: number;
  utilized: number;
  pending: number;
  balance: number;
}

export interface LeaveBalanceRow extends LeaveBalance {
  leaveTypeId: string;
  leaveTypeName: string;
}

export function roundDays(days: number): number {
  return Math.round(days * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

export function formatLeaveDays(days: number): string {
  return roundDays(days).toFixed(DAY_DECIMALS);
}

function sumDays(
  employeeId: string,
  leaveTypeId: string,
  year: number,
  status: LeaveStatus,
  requests: readonly LeaveRequest[]
): number {
  return requests
    .filter(
      request =>
        request.employeeId === employeeId &&
        request.leaveTypeId === leaveTypeId &&
        request.status === status &&
        yearOfDate(request.fromDate) === year
    )
    .reduce((total, request) => total + request.days, 0);
}

export function balanceFor(
  employeeId: string,
  leaveTypeId: string,
  year: number,
  entitlements: readonly LeaveEntitlement[],
  requests: readonly LeaveRequest[]
): LeaveBalance {
  const entitlement = entitlements
    .filter(
      item =>
        item.employeeId === employeeId && item.leaveTypeId === leaveTypeId && item.year === year
    )
    .reduce((total, item) => total + item.days, 0);
  const utilized = sumDays(employeeId, leaveTypeId, year, LeaveStatus.APPROVED, requests);
  const pending = sumDays(employeeId, leaveTypeId, year, LeaveStatus.PENDING, requests);
  return {
    entitlement: roundDays(entitlement),
    utilized: roundDays(utilized),
    pending: roundDays(pending),
    balance: roundDays(entitlement - utilized - pending),
  };
}

export function buildBalanceRows(
  employeeId: string,
  year: number,
  types: readonly LeaveType[],
  entitlements: readonly LeaveEntitlement[],
  requests: readonly LeaveRequest[]
): LeaveBalanceRow[] {
  return types.map(type => ({
    leaveTypeId: type.id,
    leaveTypeName: type.name,
    ...balanceFor(employeeId, type.id, year, entitlements, requests),
  }));
}
