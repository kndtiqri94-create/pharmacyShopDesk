import { QuotationStatus } from '../enums/quotation-status.enum';
import { Bill } from './bill.model';

export interface Quotation {
  id: string;
  quotationNo: string;
  status: QuotationStatus;
  bill: Bill;
  customerId: string;
  customerName: string;
  itemCount: number;
  totalCents: number;
  date: string;
  createdAt: string;
  createdByUserId: string;
  createdByName: string;
  convertedInvoiceNo: string | null;
}
