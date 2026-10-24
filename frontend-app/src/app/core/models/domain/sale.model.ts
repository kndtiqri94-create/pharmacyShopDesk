import { DiscountApproval } from './discount-approval.model';
import { SaleLine } from './sale-line.model';
import { SalePayment } from './sale-payment.model';

export interface Sale {
  id: string;
  invoiceNo: string;
  date: string;
  createdAt: string;
  cashierUserId: string;
  cashierName: string;
  customerId: string;
  customerName: string;
  repId: string | null;
  repName: string | null;
  lines: SaleLine[];
  payments: SalePayment[];
  subTotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  creditCents: number;
  changeCents: number;
  profitCents: number;
  discountApprovals: DiscountApproval[];
}
