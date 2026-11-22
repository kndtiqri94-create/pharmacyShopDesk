import { AttendanceStatus } from '../enums/attendance-status.enum';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  timeIn: string | null;
}
