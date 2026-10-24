import {
  ALL_SALE_PAYMENT_METHODS,
  SalePaymentMethod,
} from '../models/enums/sale-payment-method.enum';
import { formatSalePaymentMethod } from './sale-payment-label.util';

describe('formatSalePaymentMethod', () => {
  it('names exactly the four till payment methods', () => {
    expect(ALL_SALE_PAYMENT_METHODS.map(formatSalePaymentMethod)).toEqual([
      'Cash',
      'Card',
      'Online',
      'Credit',
    ]);
  });

  it('falls back to the raw value for something unknown', () => {
    expect(formatSalePaymentMethod('MORE' as SalePaymentMethod)).toBe('MORE');
  });
});
