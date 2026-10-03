export const PaymentMethod = {
  CASH: 'CASH',
  CREDIT: 'CREDIT',
  BANK: 'BANK',
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
