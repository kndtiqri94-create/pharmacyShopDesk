import { LeaveReason } from '../enums/leave-reason.enum';
import { LeaveStatus } from '../enums/leave-status.enum';

export interface LeaveRequest {
  id: string;
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
  approverComment: string;
  status: LeaveStatus;
  createdAt: string;
  decidedAt: string | null;
}
