import { AttendanceRecord } from '../../../../models/domain/attendance-record.model';
import { AttendanceStatus } from '../../../../models/enums/attendance-status.enum';

const TODAY = '2026-09-21';

export const ATTENDANCE_SEED: readonly AttendanceRecord[] = [
  {
    id: 'att-001',
    employeeId: 'emp-001',
    date: TODAY,
    status: AttendanceStatus.PRESENT,
    timeIn: '07:45',
  },
  {
    id: 'att-002',
    employeeId: 'emp-002',
    date: TODAY,
    status: AttendanceStatus.PRESENT,
    timeIn: '07:50',
  },
  {
    id: 'att-003',
    employeeId: 'emp-003',
    date: TODAY,
    status: AttendanceStatus.PRESENT,
    timeIn: '07:52',
  },
  {
    id: 'att-004',
    employeeId: 'emp-004',
    date: TODAY,
    status: AttendanceStatus.PRESENT,
    timeIn: '07:58',
  },
  {
    id: 'att-005',
    employeeId: 'emp-005',
    date: TODAY,
    status: AttendanceStatus.NOT_YET,
    timeIn: null,
  },
  {
    id: 'att-006',
    employeeId: 'emp-006',
    date: TODAY,
    status: AttendanceStatus.NOT_YET,
    timeIn: null,
  },
  {
    id: 'att-007',
    employeeId: 'emp-007',
    date: TODAY,
    status: AttendanceStatus.ON_LEAVE,
    timeIn: null,
  },
  {
    id: 'att-008',
    employeeId: 'emp-008',
    date: TODAY,
    status: AttendanceStatus.LATE,
    timeIn: '08:20',
  },
];
