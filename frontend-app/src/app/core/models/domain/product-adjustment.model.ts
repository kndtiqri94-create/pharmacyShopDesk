export interface ProductAdjustment {
  id: string;
  productId: string;
  productName: string;
  oldPriceCents: number;
  newPriceCents: number;
  oldStock: number;
  newStock: number;
  byUserId: string;
  by: string;
  at: string;
}
