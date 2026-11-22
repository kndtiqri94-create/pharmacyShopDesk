import { BillDiscountInput } from './bill-discount.model';
import { BillLine } from './bill-line.model';
import { DiscountApproval } from './discount-approval.model';
import { PaymentEntries } from './payment-entries.model';

export interface Bill {
  invoiceNo: string;
  date: string;
  customerId: string;
  repId: string | null;
  lines: BillLine[];
  billDiscount: BillDiscountInput;
  billDiscountApproval: DiscountApproval | null;
  payments: PaymentEntries;
}
