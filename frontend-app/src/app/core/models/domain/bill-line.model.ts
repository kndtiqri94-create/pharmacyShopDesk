import { DiscountApproval } from './discount-approval.model';

export interface BillLine {
  productId: string;
  sku: string;
  name: string;
  barcode: string;
  unitPriceCents: number;
  discountPercent: number;
  quantity: number;
  discountApproval: DiscountApproval | null;
}
