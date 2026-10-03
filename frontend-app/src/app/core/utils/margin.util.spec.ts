import { computeMargin } from './margin.util';

describe('margin.util', () => {
  it('works out the margin on the selling price and the profit per unit', () => {
    expect(computeMargin(210, 300)).toEqual({ kind: 'profit', percent: 30, profitCents: 90 });
  });

  it('keeps one decimal place', () => {
    expect(computeMargin(1000, 1307).percent).toBe(23.5);
  });

  it('is neutral when the cost is empty or zero', () => {
    expect(computeMargin(0, 300).kind).toBe('none');
    expect(computeMargin(-5, 300).kind).toBe('none');
  });

  it('is neutral when the selling price is empty or zero', () => {
    expect(computeMargin(100, 0).kind).toBe('none');
  });

  it('reports a loss when the cost is higher than the selling price', () => {
    expect(computeMargin(400, 300)).toEqual({ kind: 'loss', percent: -33.3, profitCents: -100 });
  });

  it('shows no margin rather than a broken figure for bad numbers', () => {
    for (const result of [computeMargin(Number.NaN, 300), computeMargin(100, Infinity)]) {
      expect(result.kind).toBe('none');
      expect(Number.isFinite(result.percent)).toBeTrue();
    }
  });

  it('shows a zero margin when cost equals price', () => {
    expect(computeMargin(300, 300)).toEqual({ kind: 'profit', percent: 0, profitCents: 0 });
  });
});
