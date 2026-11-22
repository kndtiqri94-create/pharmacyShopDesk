import { PayrollPaymentStatus } from '../enums/payroll-payment-status.enum';

export interface PayrollPayment {
  id: string;
  employeeId: string;
  month: string;
  status: PayrollPaymentStatus;
}
