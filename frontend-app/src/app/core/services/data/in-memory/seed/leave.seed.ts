import { LeaveEntitlement } from '../../../../models/domain/leave-entitlement.model';
import { LeaveRequest } from '../../../../models/domain/leave-request.model';
import { LeaveType } from '../../../../models/domain/leave-type.model';
import { LeaveReason } from '../../../../models/enums/leave-reason.enum';
import { LeaveStatus } from '../../../../models/enums/leave-status.enum';
import { EMPLOYEE_SEED } from './employee.seed';

export const LEAVE_TYPE_SEED: readonly LeaveType[] = [
  { id: 'lt-001', name: 'Annual Leave' },
  { id: 'lt-002', name: 'Carry Forward - Annual Leave' },
  { id: 'lt-003', name: 'Casual Leave' },
  { id: 'lt-004', name: 'Christmas Day' },
  { id: 'lt-005', name: 'Medical Leave' },
];

const ENTITLEMENT_DAYS: Readonly<Record<string, number>> = {
  'lt-001': 14,
  'lt-002': 0,
  'lt-003': 7,
  'lt-004': 1,
  'lt-005': 7,
};

const ENTITLEMENT_YEARS: readonly number[] = [2025, 2026, 2027];

export const LEAVE_ENTITLEMENT_SEED: readonly LeaveEntitlement[] = EMPLOYEE_SEED.flatMap(employee =>
  ENTITLEMENT_YEARS.flatMap(year =>
    LEAVE_TYPE_SEED.map(type => ({
      id: `lent-${employee.id}-${type.id}-${year}`,
      employeeId: employee.id,
      leaveTypeId: type.id,
      year,
      days: ENTITLEMENT_DAYS[type.id],
    }))
  )
);

type RequiredRequestFields = Pick<
  LeaveRequest,
  | 'id'
  | 'employeeId'
  | 'leaveTypeId'
  | 'fromDate'
  | 'toDate'
  | 'days'
  | 'reason'
  | 'approverEmployeeId'
  | 'status'
  | 'createdAt'
>;

function seedRequest(fields: RequiredRequestFields & Partial<LeaveRequest>): LeaveRequest {
  return {
    comments: '',
    attachmentName: null,
    coveringEmployeeId: null,
    approverComment: '',
    decidedAt: null,
    ...fields,
  };
}

export const LEAVE_REQUEST_SEED: readonly LeaveRequest[] = [
  seedRequest({
    id: 'leave-001',
    employeeId: 'emp-007',
    leaveTypeId: 'lt-005',
    fromDate: '2026-09-19',
    toDate: '2026-09-24',
    days: 6,
    reason: LeaveReason.MEDICAL,
    approverEmployeeId: 'emp-002',
    status: LeaveStatus.APPROVED,
    createdAt: '2026-09-15T09:00:00.000Z',
    decidedAt: '2026-09-16T10:00:00.000Z',
  }),
  seedRequest({
    id: 'leave-002',
    employeeId: 'emp-003',
    leaveTypeId: 'lt-001',
    fromDate: '2026-10-12',
    toDate: '2026-10-14',
    days: 3,
    reason: LeaveReason.FAMILY,
    comments: 'Family event out of town',
    approverEmployeeId: 'emp-002',
    status: LeaveStatus.PENDING,
    createdAt: '2026-09-18T08:30:00.000Z',
  }),
  seedRequest({
    id: 'leave-003',
    employeeId: 'emp-004',
    leaveTypeId: 'lt-003',
    fromDate: '2026-05-04',
    toDate: '2026-05-05',
    days: 2,
    reason: LeaveReason.PERSONAL,
    approverEmployeeId: 'emp-001',
    status: LeaveStatus.APPROVED,
    createdAt: '2026-04-28T09:00:00.000Z',
    decidedAt: '2026-04-29T09:00:00.000Z',
  }),
  seedRequest({
    id: 'leave-004',
    employeeId: 'emp-005',
    leaveTypeId: 'lt-001',
    fromDate: '2026-06-15',
    toDate: '2026-06-17',
    days: 3,
    reason: LeaveReason.TRAVEL,
    approverEmployeeId: 'emp-002',
    approverComment: 'Short staffed that week',
    status: LeaveStatus.REJECTED,
    createdAt: '2026-06-01T09:00:00.000Z',
    decidedAt: '2026-06-02T09:00:00.000Z',
  }),
  seedRequest({
    id: 'leave-005',
    employeeId: 'emp-006',
    leaveTypeId: 'lt-003',
    fromDate: '2026-07-20',
    toDate: '2026-07-20',
    days: 1,
    reason: LeaveReason.OTHER,
    approverEmployeeId: 'emp-002',
    status: LeaveStatus.CANCELLED,
    createdAt: '2026-07-10T09:00:00.000Z',
    decidedAt: '2026-07-12T09:00:00.000Z',
  }),
  seedRequest({
    id: 'leave-006',
    employeeId: 'emp-003',
    leaveTypeId: 'lt-001',
    fromDate: '2025-12-22',
    toDate: '2025-12-24',
    days: 3,
    reason: LeaveReason.FAMILY,
    approverEmployeeId: 'emp-001',
    status: LeaveStatus.APPROVED,
    createdAt: '2025-12-01T09:00:00.000Z',
    decidedAt: '2025-12-02T09:00:00.000Z',
  }),
  seedRequest({
    id: 'leave-007',
    employeeId: 'emp-004',
    leaveTypeId: 'lt-004',
    fromDate: '2025-12-25',
    toDate: '2025-12-25',
    days: 1,
    reason: LeaveReason.OTHER,
    approverEmployeeId: 'emp-001',
    status: LeaveStatus.APPROVED,
    createdAt: '2025-12-05T09:00:00.000Z',
    decidedAt: '2025-12-06T09:00:00.000Z',
  }),
  seedRequest({
    id: 'leave-008',
    employeeId: 'emp-005',
    leaveTypeId: 'lt-005',
    fromDate: '2025-03-10',
    toDate: '2025-03-11',
    days: 2,
    reason: LeaveReason.MEDICAL,
    approverEmployeeId: 'emp-002',
    status: LeaveStatus.CANCELLED,
    createdAt: '2025-03-05T09:00:00.000Z',
    decidedAt: '2025-03-06T09:00:00.000Z',
  }),
  seedRequest({
    id: 'leave-009',
    employeeId: 'emp-002',
    leaveTypeId: 'lt-001',
    fromDate: '2026-12-24',
    toDate: '2026-12-26',
    days: 3,
    reason: LeaveReason.TRAVEL,
    coveringEmployeeId: 'emp-003',
    approverEmployeeId: 'emp-001',
    status: LeaveStatus.APPROVED,
    createdAt: '2026-09-10T09:00:00.000Z',
    decidedAt: '2026-09-11T09:00:00.000Z',
  }),
  seedRequest({
    id: 'leave-010',
    employeeId: 'emp-006',
    leaveTypeId: 'lt-001',
    fromDate: '2027-01-11',
    toDate: '2027-01-12',
    days: 2,
    reason: LeaveReason.PERSONAL,
    approverEmployeeId: 'emp-002',
    status: LeaveStatus.PENDING,
    createdAt: '2026-09-19T09:00:00.000Z',
  }),
];
