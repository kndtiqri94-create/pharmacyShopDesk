export const StockMovementType = {
  SALE: 'SALE',
  RETURN: 'RETURN',
  GRN: 'GRN',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];
