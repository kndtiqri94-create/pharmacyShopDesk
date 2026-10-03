import { formatCount, formatMoneyCell, formatRupees, rupeesToCents } from './money.util';

describe('money.util', () => {
  it('formats whole rupees without decimals', () => {
    expect(formatRupees(8_425_000)).toBe('Rs. 84,250');
  });

  it('shows decimals when there are cents', () => {
    expect(formatRupees(8_425_050)).toBe('Rs. 84,250.50');
  });

  it('formats negative amounts with a leading minus', () => {
    expect(formatRupees(-250)).toBe('-Rs. 2.50');
  });

  it('formats table cells with two decimals', () => {
    expect(formatMoneyCell(14_260_000)).toBe('142,600.00');
    expect(formatMoneyCell(5)).toBe('0.05');
  });

  it('converts rupees to integer cents', () => {
    expect(rupeesToCents(12.5)).toBe(1250);
    expect(rupeesToCents(0.1 + 0.2)).toBe(30);
  });

  it('formats counts with thousands separators', () => {
    expect(formatCount(1240)).toBe('1,240');
  });
});
