import { PoStatus } from '../enums/po-status.enum';
import { PurchaseOrderLine } from './purchase-order-line.model';

export interface PurchaseOrder {
  id: string;
  number: string;
  orderDate: string;
  expectedDate: string;
  supplierId: string;
  status: PoStatus;
  notes: string;
  totalCents: number;
  lines: PurchaseOrderLine[];
}
