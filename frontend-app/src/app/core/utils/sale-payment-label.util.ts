import { SalePaymentMethod } from '../models/enums/sale-payment-method.enum';

export const SALE_PAYMENT_METHOD_LABELS: Record<SalePaymentMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  ONLINE: 'Online',
  CREDIT: 'Credit',
};

export function formatSalePaymentMethod(method: SalePaymentMethod): string {
  return SALE_PAYMENT_METHOD_LABELS[method] ?? method;
}
