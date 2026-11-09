export const CashEntryKind = {
  OPENING: 'OPENING',
  SALE_CASH: 'SALE_CASH',
  RETURN_REFUND: 'RETURN_REFUND',
  DUE_PAYMENT: 'DUE_PAYMENT',
} as const;

export type CashEntryKind = (typeof CashEntryKind)[keyof typeof CashEntryKind];
