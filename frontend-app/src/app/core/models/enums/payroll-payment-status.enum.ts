export const PayrollPaymentStatus = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
} as const;

export type PayrollPaymentStatus = (typeof PayrollPaymentStatus)[keyof typeof PayrollPaymentStatus];
