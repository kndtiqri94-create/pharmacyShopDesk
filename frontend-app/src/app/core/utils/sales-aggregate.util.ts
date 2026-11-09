import { SaleReturn } from '../models/domain/sale-return.model';
import { returnProfitCents } from './pos-return.util';
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

export function returnTotalsForDate(
  returns: readonly SaleReturn[],
  date: string
): Pick<SalesDayTotals, 'salesCents' | 'profitCents'> {
  return returns
    .filter(item => item.date === date)
    .reduce(
      (totals, item) => ({
        salesCents: totals.salesCents + item.totalCents,
        profitCents: totals.profitCents + returnProfitCents(item),
      }),
      { salesCents: 0, profitCents: 0 }
    );
}
