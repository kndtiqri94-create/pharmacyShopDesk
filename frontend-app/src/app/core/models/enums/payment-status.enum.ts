export const PaymentStatus = {
  PAID: 'PAID',
  PART_PAID: 'PART_PAID',
  UNPAID: 'UNPAID',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
