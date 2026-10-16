import { PAYMENT_METHOD_LABEL, parsePaymentMethod } from './payment-method-display.util';

describe('payment-method-display.util', () => {
  it('words each method for the shopkeeper, with credit as pay later', () => {
    expect(PAYMENT_METHOD_LABEL.CREDIT).toBe('Credit (pay later)');
    expect(PAYMENT_METHOD_LABEL.CASH).toBe('Cash');
    expect(PAYMENT_METHOD_LABEL.BANK).toBe('Bank transfer');
  });

  it('accepts only known methods', () => {
    expect(parsePaymentMethod('CASH')).toBe('CASH');
    expect(parsePaymentMethod('BITCOIN')).toBeNull();
    expect(parsePaymentMethod('')).toBeNull();
  });
});
