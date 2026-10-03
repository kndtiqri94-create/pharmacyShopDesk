export interface GrnLine {
  productId: string;
  batchNo: string;
  expiryDate: string | null;
  receivedQuantity: number;
  freeQuantity: number;
  costCents: number;
  priceCents: number;
}
