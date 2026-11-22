export const BillType = {
  INVOICE: 'INVOICE',
  RETURN: 'RETURN',
} as const;

export type BillType = (typeof BillType)[keyof typeof BillType];

export const ALL_BILL_TYPES: readonly BillType[] = [BillType.INVOICE, BillType.RETURN];

export const BILL_TYPE_LABELS: Record<BillType, string> = {
  INVOICE: 'Invoice',
  RETURN: 'Return',
};
