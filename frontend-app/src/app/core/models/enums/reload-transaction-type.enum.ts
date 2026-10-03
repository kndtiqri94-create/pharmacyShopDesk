export const ReloadTransactionType = {
  RELOAD: 'RELOAD',
  BILL_PAYMENT: 'BILL_PAYMENT',
} as const;

export type ReloadTransactionType =
  (typeof ReloadTransactionType)[keyof typeof ReloadTransactionType];
