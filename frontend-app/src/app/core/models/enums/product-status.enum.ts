export const ProductStatus = {
  IN_STOCK: 'IN_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  EXPIRING_SOON: 'EXPIRING_SOON',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
} as const;

export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];
