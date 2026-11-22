import { LeaveRequest } from '../models/domain/leave-request.model';
import { LeaveType } from '../models/domain/leave-type.model';
import { SalaryAdvance } from '../models/domain/salary-advance.model';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { daysBetween, endOfMonth } from './date.util';
import { monthOfDate } from './payroll-calculation.util';

export interface PayrollLeaveRecord {
  id: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  daysInMonth: number;
}

export interface PayrollRecords {
  advances: readonly SalaryAdvance[];
  leaves: readonly PayrollLeaveRecord[];
}

export function selectPayrollRecords(
  employeeId: string,
  month: string,
  advances: readonly SalaryAdvance[],
  leaves: readonly LeaveRequest[],
  leaveTypes: readonly LeaveType[]
): PayrollRecords {
  const monthStart = `${month}-01`;
  const monthEnd = endOfMonth(monthStart);
  const monthAdvances = advances
    .filter(item => item.employeeId === employeeId && monthOfDate(item.date) === month)
    .sort((left, right) => left.date.localeCompare(right.date));
  const monthLeaves =
    monthEnd === ''
      ? []
      : leaves
          .filter(item => item.employeeId === employeeId && item.status === LeaveStatus.APPROVED)
          .map(item => {
            const from = item.fromDate > monthStart ? item.fromDate : monthStart;
            const to = item.toDate < monthEnd ? item.toDate : monthEnd;
            return {
              id: item.id,
              leaveTypeName: leaveTypes.find(type => type.id === item.leaveTypeId)?.name ?? '',
              fromDate: item.fromDate,
              toDate: item.toDate,
              daysInMonth: daysBetween(from, to) + 1,
            };
          })
          .filter(item => item.daysInMonth > 0)
          .sort((left, right) => left.fromDate.localeCompare(right.fromDate));
  return { advances: monthAdvances, leaves: monthLeaves };
}
