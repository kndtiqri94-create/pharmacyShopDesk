import {
  DENOMINATION_COUNT_ERROR,
  DENOMINATION_TOTAL_ERROR,
  LKR_DENOMINATIONS,
  MAX_DENOMINATION_COUNT,
  denominationLabel,
  denominationLineCents,
  parseDenominationCount,
  summarizeDenominations,
} from './denomination.util';

describe('denomination util', () => {
  it('lists the circulating rupee notes and coins, largest first', () => {
    const notes = LKR_DENOMINATIONS.filter(item => item.kind === 'NOTE').map(
      item => item.valueRupees
    );
    const coins = LKR_DENOMINATIONS.filter(item => item.kind === 'COIN').map(
      item => item.valueRupees
    );
    expect(notes).toEqual([5000, 2000, 1000, 500, 100, 50, 20]);
    expect(coins).toEqual([10, 5, 2, 1]);
  });

  it('labels each denomination', () => {
    expect(denominationLabel(LKR_DENOMINATIONS[0])).toBe('Rs. 5,000 note');
    expect(denominationLabel(LKR_DENOMINATIONS[10])).toBe('Rs. 1 coin');
  });

  it('parses whole counts and treats blank as zero', () => {
    expect(parseDenominationCount('')).toBe(0);
    expect(parseDenominationCount('  ')).toBe(0);
    expect(parseDenominationCount('0')).toBe(0);
    expect(parseDenominationCount(' 12 ')).toBe(12);
    expect(parseDenominationCount(String(MAX_DENOMINATION_COUNT))).toBe(MAX_DENOMINATION_COUNT);
  });

  it('refuses negative, fractional, non numeric and oversized counts', () => {
    for (const bad of ['-1', '1.5', '1e3', 'abc', 'NaN', '100001', '9999999', '١٢']) {
      expect(parseDenominationCount(bad)).withContext(bad).toBeNull();
    }
  });

  it('works out a line amount in cents', () => {
    expect(denominationLineCents({ valueRupees: 500, kind: 'NOTE' }, 3)).toBe(150_000);
    expect(denominationLineCents({ valueRupees: 1, kind: 'COIN' }, 0)).toBe(0);
  });

  it('totals the lines and ignores blank rows', () => {
    const summary = summarizeDenominations({ 5000: '2', 100: '3', 1: '7' });
    expect(summary.valid).toBeTrue();
    expect(summary.totalCents).toBe((10_000 + 300 + 7) * 100);
    expect(summary.entries).toHaveSize(LKR_DENOMINATIONS.length);
    expect(summary.entries.find(item => item.denomination.valueRupees === 20)?.count).toBe(0);
  });

  it('is valid with all counts zero', () => {
    const summary = summarizeDenominations({});
    expect(summary.valid).toBeTrue();
    expect(summary.totalCents).toBe(0);
  });

  it('flags a bad count on its row and is not valid', () => {
    const summary = summarizeDenominations({ 1000: '-2', 500: '1' });
    expect(summary.valid).toBeFalse();
    expect(summary.entries.find(item => item.denomination.valueRupees === 1000)?.error).toBe(
      DENOMINATION_COUNT_ERROR
    );
    expect(summary.entries.find(item => item.denomination.valueRupees === 500)?.error).toBeNull();
  });

  it('refuses a total that is too large even when each count is allowed', () => {
    const texts: Record<number, string> = {};
    for (const item of LKR_DENOMINATIONS) texts[item.valueRupees] = String(MAX_DENOMINATION_COUNT);
    const summary = summarizeDenominations(texts);
    expect(summary.totalError).toBe(DENOMINATION_TOTAL_ERROR);
    expect(summary.valid).toBeFalse();
  });
});
