import { validatePaymentAmount } from './supplier-payment-validation.util';

describe('supplier-payment-validation.util', () => {
  const outstanding = 1_000_000;

  it('accepts a valid amount and converts it once to cents', () => {
    expect(validatePaymentAmount('1500.50', outstanding)).toEqual({
      amountCents: 150_050,
      error: null,
    });
    expect(validatePaymentAmount(' 10000 ', outstanding).amountCents).toBe(1_000_000);
  });

  it('asks for an amount when empty', () => {
    expect(validatePaymentAmount('   ', outstanding).error).toBe('Enter the amount you are paying');
  });

  it('rejects text, commas, scientific notation and too many decimals', () => {
    for (const text of ['abc', '1,500', '1e3', '1.234', '1..2', 'NaN', 'Infinity', '12 5']) {
      const result = validatePaymentAmount(text, outstanding);
      expect(result.amountCents).withContext(text).toBeNull();
      expect(result.error)
        .withContext(text)
        .toBe('Enter the amount as a number, for example 1500.00');
    }
  });

  it('rejects zero and negative amounts', () => {
    expect(validatePaymentAmount('0', outstanding).error).toBe('Enter an amount above zero');
    expect(validatePaymentAmount('0.00', outstanding).error).toBe('Enter an amount above zero');
    expect(validatePaymentAmount('-5', outstanding).error).toBe('Enter an amount above zero');
  });

  it('rejects more than the outstanding amount and says the most allowed', () => {
    const result = validatePaymentAmount('10000.01', outstanding);
    expect(result.amountCents).toBeNull();
    expect(result.error).toBe('The amount can be at most Rs. 10,000');
  });

  it('rejects any amount when nothing is outstanding', () => {
    expect(validatePaymentAmount('1', 0).error).toBe('The amount can be at most Rs. 0');
  });
});
