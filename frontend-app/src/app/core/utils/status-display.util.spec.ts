import { AttendanceStatus } from '../models/enums/attendance-status.enum';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { GrnStatus } from '../models/enums/grn-status.enum';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { PaymentStatus } from '../models/enums/payment-status.enum';
import { PayrollPaymentStatus } from '../models/enums/payroll-payment-status.enum';
import { PoStatus } from '../models/enums/po-status.enum';
import { ProductStatus } from '../models/enums/product-status.enum';
import { ReloadStatus } from '../models/enums/reload-status.enum';
import { ReloadTransactionType } from '../models/enums/reload-transaction-type.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import {
  ATTENDANCE_STATUS_DISPLAY,
  EMPLOYEE_STATUS_DISPLAY,
  GRN_STATUS_DISPLAY,
  LEAVE_STATUS_DISPLAY,
  getActiveDisplay,
  PAYMENT_STATUS_DISPLAY,
  PAYROLL_PAYMENT_STATUS_DISPLAY,
  PO_STATUS_DISPLAY,
  PRODUCT_STATUS_DISPLAY,
  RELOAD_STATUS_DISPLAY,
  RELOAD_TYPE_LABEL,
  USER_STATUS_DISPLAY,
} from './status-display.util';

describe('status-display.util', () => {
  it('uses the design status words and tones for products', () => {
    expect(PRODUCT_STATUS_DISPLAY[ProductStatus.IN_STOCK]).toEqual({
      label: 'In stock',
      tone: 'success',
    });
    expect(PRODUCT_STATUS_DISPLAY[ProductStatus.LOW_STOCK].tone).toBe('warning');
    expect(PRODUCT_STATUS_DISPLAY[ProductStatus.EXPIRING_SOON].label).toBe('Expiring soon');
    expect(PRODUCT_STATUS_DISPLAY[ProductStatus.OUT_OF_STOCK].tone).toBe('danger');
  });

  it('uses the design status words for GRN, payment, PO and reload', () => {
    expect(GRN_STATUS_DISPLAY[GrnStatus.DRAFT].tone).toBe('info');
    expect(PAYMENT_STATUS_DISPLAY[PaymentStatus.PART_PAID].label).toBe('Part paid');
    expect(PO_STATUS_DISPLAY[PoStatus.PART_RECEIVED].label).toBe('Part received');
    expect(RELOAD_STATUS_DISPLAY[ReloadStatus.PENDING].tone).toBe('warning');
    expect(RELOAD_STATUS_DISPLAY[ReloadStatus.SUCCESS]).toEqual({
      label: 'Success',
      tone: 'success',
    });
    expect(RELOAD_STATUS_DISPLAY[ReloadStatus.FAILED]).toEqual({ label: 'Failed', tone: 'danger' });
    expect(RELOAD_TYPE_LABEL[ReloadTransactionType.RELOAD]).toBe('Reload');
    expect(RELOAD_TYPE_LABEL[ReloadTransactionType.BILL_PAYMENT]).toBe('Bill payment');
  });

  it('uses the design words for attendance, employee and user status', () => {
    expect(ATTENDANCE_STATUS_DISPLAY[AttendanceStatus.PRESENT]).toEqual({
      label: 'Present',
      tone: 'success',
    });
    expect(ATTENDANCE_STATUS_DISPLAY[AttendanceStatus.LATE].label).toBe('Late');
    expect(ATTENDANCE_STATUS_DISPLAY[AttendanceStatus.NOT_YET].label).toBe('Not yet');
    expect(ATTENDANCE_STATUS_DISPLAY[AttendanceStatus.ON_LEAVE].label).toBe('On leave');
    expect(EMPLOYEE_STATUS_DISPLAY[EmployeeStatus.ON_LEAVE].label).toBe('On leave');
    expect(EMPLOYEE_STATUS_DISPLAY[EmployeeStatus.INACTIVE]).toEqual({
      label: 'Inactive',
      tone: 'neutral',
    });
    expect(USER_STATUS_DISPLAY[UserStatus.DISABLED]).toEqual({
      label: 'Disabled',
      tone: 'neutral',
    });
  });

  it('uses the words and tones for leave status', () => {
    expect(LEAVE_STATUS_DISPLAY[LeaveStatus.PENDING]).toEqual({
      label: 'Pending',
      tone: 'warning',
    });
    expect(LEAVE_STATUS_DISPLAY[LeaveStatus.APPROVED]).toEqual({
      label: 'Approved',
      tone: 'success',
    });
    expect(LEAVE_STATUS_DISPLAY[LeaveStatus.REJECTED]).toEqual({
      label: 'Rejected',
      tone: 'danger',
    });
    expect(LEAVE_STATUS_DISPLAY[LeaveStatus.CANCELLED]).toEqual({
      label: 'Cancelled',
      tone: 'neutral',
    });
  });

  it('uses the words and tones for payroll payment status', () => {
    expect(PAYROLL_PAYMENT_STATUS_DISPLAY[PayrollPaymentStatus.UNPAID]).toEqual({
      label: 'Unpaid',
      tone: 'warning',
    });
    expect(PAYROLL_PAYMENT_STATUS_DISPLAY[PayrollPaymentStatus.PAID]).toEqual({
      label: 'Paid',
      tone: 'success',
    });
  });

  it('never leaves a status without a word', () => {
    const all = [
      ...Object.values(PRODUCT_STATUS_DISPLAY),
      ...Object.values(GRN_STATUS_DISPLAY),
      ...Object.values(PAYMENT_STATUS_DISPLAY),
      ...Object.values(PO_STATUS_DISPLAY),
      ...Object.values(RELOAD_STATUS_DISPLAY),
      ...Object.values(ATTENDANCE_STATUS_DISPLAY),
      ...Object.values(EMPLOYEE_STATUS_DISPLAY),
      ...Object.values(LEAVE_STATUS_DISPLAY),
      ...Object.values(USER_STATUS_DISPLAY),
      ...Object.values(PAYROLL_PAYMENT_STATUS_DISPLAY),
    ];
    expect(all.every(display => display.label.length > 0)).toBeTrue();
  });

  it('shows an inactive product with a word and a neutral tone', () => {
    expect(getActiveDisplay(false)).toEqual({ label: 'Inactive', tone: 'neutral' });
    expect(getActiveDisplay(true).label).toBe('Active');
  });
});
