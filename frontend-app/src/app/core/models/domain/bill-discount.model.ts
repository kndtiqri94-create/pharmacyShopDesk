export type BillDiscountInput =
  { mode: 'PERCENT'; percent: number } | { mode: 'AMOUNT'; cents: number };
