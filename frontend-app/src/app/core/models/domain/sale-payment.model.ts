import { SalePaymentMethod } from '../enums/sale-payment-method.enum';

export interface SalePayment {
  method: SalePaymentMethod;
  amountCents: number;
  reference: string;
}
