export const QuotationStatus = {
  OPEN: 'OPEN',
  CONVERTED: 'CONVERTED',
} as const;

export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  OPEN: 'Open',
  CONVERTED: 'Converted',
};
