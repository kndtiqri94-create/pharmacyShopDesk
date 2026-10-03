export interface PurchaseOrderLine {
  productId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCostCents: number;
}
