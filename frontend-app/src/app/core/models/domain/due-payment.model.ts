import { SalePaymentMethod } from '../enums/sale-payment-method.enum';

export interface DuePayment {
  id: string;
  receiptNo: string;
  customerId: string;
  customerName: string;
  amountCents: number;
  method: SalePaymentMethod;
  reference: string;
  createdAt: string;
  takenByUserId: string;
  takenBy: string;
}
