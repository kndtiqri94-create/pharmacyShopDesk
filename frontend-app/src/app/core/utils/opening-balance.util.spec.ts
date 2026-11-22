import { openingChanged, parseOpeningBalance } from './opening-balance.util';

describe('opening balance util', () => {
  it('accepts zero and positive amounts with up to two decimals', () => {
    expect(parseOpeningBalance('0')).toEqual({ ok: true, cents: 0 });
    expect(parseOpeningBalance('5000.50')).toEqual({ ok: true, cents: 500_050 });
  });

  it('refuses blank, negative, non numeric and over precise amounts', () => {
    for (const bad of ['', '-1', 'abc', '1.999', 'NaN', 'Infinity']) {
      expect(parseOpeningBalance(bad).ok).withContext(bad).toBeFalse();
    }
  });

  it('detects a change', () => {
    expect(openingChanged(100, 100)).toBeFalse();
    expect(openingChanged(100, 101)).toBeTrue();
  });
});
