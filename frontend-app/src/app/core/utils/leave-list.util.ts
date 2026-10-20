import { Employee } from '../models/domain/employee.model';
import { LeaveRequest } from '../models/domain/leave-request.model';
import { LeaveType } from '../models/domain/leave-type.model';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { formatEntriesText, pageCountOf, parseEmployeePageSize } from './employee-list.util';
import { LEAVE_STATUS_DISPLAY } from './status-display.util';

export type LeaveStatusFilter = 'all' | LeaveStatus;

export interface LeaveListRow {
  request: LeaveRequest;
  employeeName: string;
  employeeCode: string;
  leaveTypeName: string;
  approverName: string;
  coveringName: string;
}

export interface LeaveStatusChip {
  id: LeaveStatusFilter;
  label: string;
  count: number;
}

export interface LeavePage {
  rows: LeaveListRow[];
  page: number;
  pageCount: number;
  total: number;
  entriesText: string;
}

const UNKNOWN = 'Unknown';
const NO_VALUE = '–';

const CHIP_ORDER: readonly LeaveStatus[] = [
  LeaveStatus.PENDING,
  LeaveStatus.APPROVED,
  LeaveStatus.REJECTED,
  LeaveStatus.CANCELLED,
];

export function parseLeaveStatusFilter(value: string | null): LeaveStatusFilter {
  return CHIP_ORDER.find(status => status === value) ?? 'all';
}

export function buildLeaveListRows(
  requests: readonly LeaveRequest[],
  employees: readonly Employee[],
  types: readonly LeaveType[]
): LeaveListRow[] {
  const nameOf = (id: string | null): string =>
    id === null ? NO_VALUE : (employees.find(employee => employee.id === id)?.name ?? UNKNOWN);
  return sortLeaveNewestFirst(requests).map(request => {
    const employee = employees.find(item => item.id === request.employeeId);
    return {
      request,
      employeeName: employee?.name ?? UNKNOWN,
      employeeCode: employee?.code ?? NO_VALUE,
      leaveTypeName: types.find(type => type.id === request.leaveTypeId)?.name ?? UNKNOWN,
      approverName: nameOf(request.approverEmployeeId),
      coveringName: nameOf(request.coveringEmployeeId),
    };
  });
}

export function sortLeaveNewestFirst(requests: readonly LeaveRequest[]): LeaveRequest[] {
  return [...requests].sort((a, b) => {
    if (a.fromDate !== b.fromDate) return a.fromDate < b.fromDate ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

export function buildLeaveStatusChips(requests: readonly LeaveRequest[]): LeaveStatusChip[] {
  return [
    { id: 'all', label: 'All', count: requests.length },
    ...CHIP_ORDER.map(status => ({
      id: status,
      label: LEAVE_STATUS_DISPLAY[status].label,
      count: requests.filter(request => request.status === status).length,
    })),
  ];
}

export function filterLeaveRows(
  rows: readonly LeaveListRow[],
  status: LeaveStatusFilter,
  keyword = ''
): LeaveListRow[] {
  const needle = keyword.trim().toLowerCase();
  return rows.filter(
    row =>
      (status === 'all' || row.request.status === status) &&
      (needle === '' ||
        row.employeeName.toLowerCase().includes(needle) ||
        row.employeeCode.toLowerCase().includes(needle))
  );
}

export function paginateLeaveRows(
  rows: readonly LeaveListRow[],
  requestedPage: number,
  requestedPageSize: number
): LeavePage {
  const pageSize = parseEmployeePageSize(requestedPageSize);
  const total = rows.length;
  const pageCount = pageCountOf(total, pageSize);
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pageCount);
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount,
    total,
    entriesText: formatEntriesText(page, pageSize, total),
  };
}
