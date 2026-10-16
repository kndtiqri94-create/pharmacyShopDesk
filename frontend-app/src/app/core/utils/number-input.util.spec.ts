import { parseCents, parseQuantity } from './number-input.util';

describe('number-input.util', () => {
  it('parses money text strictly into cents', () => {
    expect(parseCents('12.50')).toBe(1250);
    expect(parseCents('12.505')).toBeNull();
    expect(parseCents('99999999999')).toBeNull();
    expect(parseCents('-1')).toBeNull();
    expect(parseCents('1e3')).toBeNull();
    expect(parseCents('')).toBeNull();
  });

  it('parses quantity text as a whole number within the limit', () => {
    expect(parseQuantity('12')).toBe(12);
    expect(parseQuantity('1.5')).toBeNull();
    expect(parseQuantity('99999999')).toBeNull();
    expect(parseQuantity('abc')).toBeNull();
  });
});
