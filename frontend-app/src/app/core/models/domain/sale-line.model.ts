export interface BatchAllocation {
  batchId: string | null;
  batchNo: string;
  quantity: number;
  costCents: number;
}

export interface SaleLine {
  productId: string;
  sku: string;
  name: string;
  barcode: string;
  unitPriceCents: number;
  discountPercent: number;
  quantity: number;
  totalCents: number;
  batchAllocations: BatchAllocation[];
}
