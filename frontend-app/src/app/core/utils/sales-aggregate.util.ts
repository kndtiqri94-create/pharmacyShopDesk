import { Sale } from '../models/domain/sale.model';

export interface SalesDayTotals {
  salesCents: number;
  profitCents: number;
  bills: number;
}

const EMPTY_TOTALS: SalesDayTotals = { salesCents: 0, profitCents: 0, bills: 0 };

export function totalsForDate(sales: readonly Sale[], date: string): SalesDayTotals {
  return sales
    .filter(sale => sale.date === date)
    .reduce(
      (totals, sale) => ({
        salesCents: totals.salesCents + sale.totalCents,
        profitCents: totals.profitCents + sale.profitCents,
        bills: totals.bills + 1,
      }),
      EMPTY_TOTALS
    );
}
