export const ReturnSettlement = {
  CASH_REFUND: 'CASH_REFUND',
  CUSTOMER_CREDIT: 'CUSTOMER_CREDIT',
} as const;

export type ReturnSettlement = (typeof ReturnSettlement)[keyof typeof ReturnSettlement];

export const RETURN_SETTLEMENT_LABELS: Record<ReturnSettlement, string> = {
  CASH_REFUND: 'Cash refund',
  CUSTOMER_CREDIT: 'Customer credit',
};
