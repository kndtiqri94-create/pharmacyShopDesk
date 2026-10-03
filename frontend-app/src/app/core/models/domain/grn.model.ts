import { GrnStatus } from '../enums/grn-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { GrnLine } from './grn-line.model';

export interface Grn {
  id: string;
  number: string;
  receivedDate: string;
  supplierId: string;
  invoiceNo: string;
  invoiceDate: string;
  purchaseOrderNumber: string | null;
  receivedBy: string;
  status: GrnStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paidCents: number;
  dueDate: string | null;
  discountCents: number;
  totalCents: number;
  lines: GrnLine[];
}
