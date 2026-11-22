import { SalePaymentMethod } from '../enums/sale-payment-method.enum';
import { BankAccountSnapshot } from './bank-account.model';

export interface SalePayment {
  method: SalePaymentMethod;
  amountCents: number;
  reference: string;
  account?: BankAccountSnapshot | null;
  cardLast4?: string | null;
  note?: string;
}
