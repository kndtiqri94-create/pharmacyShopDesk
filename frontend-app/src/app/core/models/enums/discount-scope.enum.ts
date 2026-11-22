export const DiscountScope = {
  LINE: 'LINE',
  BILL: 'BILL',
} as const;

export type DiscountScope = (typeof DiscountScope)[keyof typeof DiscountScope];
