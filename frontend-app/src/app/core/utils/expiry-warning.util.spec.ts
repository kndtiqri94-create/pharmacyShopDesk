import { findExpiryWarnings, isShortDated } from './expiry-warning.util';

const TODAY = '2026-09-21';

describe('expiry-warning.util', () => {
  it('names the product, the months and the month in the warning', () => {
    const [warning] = findExpiryWarnings(
      [{ productName: 'Amoxicillin 500mg', expiry: '02/2027' }],
      TODAY
    );
    expect(warning.message).toBe(
      'Amoxicillin 500mg expires in 5 months (02/2027). Check with the supplier before accepting.'
    );
  });

  it('does not warn at exactly six months or beyond', () => {
    expect(isShortDated('03/2027', TODAY)).toBeFalse();
    expect(isShortDated('02/2027', TODAY)).toBeTrue();
  });

  it('warns for every short-dated line and keeps line positions', () => {
    const warnings = findExpiryWarnings(
      [
        { productName: 'A', expiry: '01/2027' },
        { productName: 'B', expiry: '01/2030' },
        { productName: 'C', expiry: '10/2026' },
      ],
      TODAY
    );
    expect(warnings.map(warning => warning.lineIndex)).toEqual([0, 2]);
  });

  it('clears the warning once the date is corrected', () => {
    const line = { productName: 'A', expiry: '01/2027' };
    expect(findExpiryWarnings([line], TODAY)).toHaveSize(1);
    expect(findExpiryWarnings([{ ...line, expiry: '01/2029' }], TODAY)).toEqual([]);
  });

  it('words an expired date and this month differently', () => {
    const [past, now] = findExpiryWarnings(
      [
        { productName: 'A', expiry: '08/2026' },
        { productName: 'B', expiry: '09/2026' },
      ],
      TODAY
    );
    expect(past.message).toContain('already past its expiry date (08/2026)');
    expect(now.message).toContain('expires this month (09/2026)');
  });

  it('ignores blank or malformed expiry text', () => {
    expect(findExpiryWarnings([{ productName: 'A', expiry: '' }], TODAY)).toEqual([]);
    expect(isShortDated('13/2027', TODAY)).toBeFalse();
    expect(isShortDated('3/27', TODAY)).toBeFalse();
  });
});
