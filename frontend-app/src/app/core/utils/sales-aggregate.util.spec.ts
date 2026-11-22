import { Sale } from '../models/domain/sale.model';
import { totalsForDate } from './sales-aggregate.util';

const sale = (date: string, totalCents: number, profitCents: number): Sale =>
  ({ date, totalCents, profitCents }) as Sale;

describe('totalsForDate', () => {
  it('adds up the sales, profit and bills of one day only', () => {
    const sales = [
      sale('2026-09-21', 1000, 200),
      sale('2026-09-21', 500, 50),
      sale('2026-09-20', 900, 90),
    ];
    expect(totalsForDate(sales, '2026-09-21')).toEqual({
      salesCents: 1500,
      profitCents: 250,
      bills: 2,
    });
  });

  it('gives zeros, not an error, when nothing was sold that day', () => {
    expect(totalsForDate([], '2026-09-21')).toEqual({ salesCents: 0, profitCents: 0, bills: 0 });
    expect(totalsForDate([sale('2026-09-20', 1, 1)], '2026-09-21').bills).toBe(0);
  });
});
