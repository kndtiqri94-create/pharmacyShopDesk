import { ReturnSettlement } from '../enums/return-settlement.enum';

export interface ReturnAllocation {
  batchId: string | null;
  batchNo: string;
  quantity: number;
  costCents: number;
}

export interface SaleReturnLine {
  productId: string;
  sku: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
  restockAllocations: ReturnAllocation[];
}

export interface SaleReturn {
  id: string;
  returnNo: string;
  originalSaleId: string;
  originalInvoiceNo: string;
  customerId: string;
  customerName: string;
  lines: SaleReturnLine[];
  totalCents: number;
  settlement: ReturnSettlement;
  date: string;
  createdAt: string;
  processedByUserId: string;
  processedByName: string;
}
