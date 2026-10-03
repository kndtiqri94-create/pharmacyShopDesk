import { DailySalesPoint } from '../models/domain/sales-summary.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import { SALES_SEED } from '../services/data/in-memory/seed/sales.seed';
import {
  buildChartBars,
  buildNeedsAttention,
  computeStockAlertCounts,
  countExpiringBatches,
  expireByDate,
  formatProfitMargin,
  formatSalesChange,
  mostUrgentLowStock,
} from './dashboard-metrics.util';

const TODAY = '2026-09-21';

describe('dashboard-metrics.util', () => {
  it('counts stock alerts that match the product list statuses', () => {
    expect(computeStockAlertCounts(PRODUCT_SEED, 60, TODAY)).toEqual({
      needsRestock: 3,
      outOfStock: 1,
      expiringBatches: 1,
    });
  });

  it('counts expiring batches per batch and ignores empty batches and untracked products', () => {
    const product = {
      ...PRODUCT_SEED[0],
      batches: [
        { id: 'a', batchNo: 'A', expiryDate: '2026-10-01', quantity: 5, costCents: 1 },
        { id: 'b', batchNo: 'B', expiryDate: '2026-10-02', quantity: 0, costCents: 1 },
        { id: 'c', batchNo: 'C', expiryDate: '2026-11-20', quantity: 5, costCents: 1 },
        { id: 'd', batchNo: 'D', expiryDate: '2026-11-21', quantity: 5, costCents: 1 },
      ],
    };
    expect(countExpiringBatches([product], 60, TODAY)).toBe(2);
    expect(countExpiringBatches([{ ...product, trackBatches: false }], 60, TODAY)).toBe(0);
  });

  it('lists the most urgent low-stock products first, out of stock then lowest stock', () => {
    const rows = mostUrgentLowStock(PRODUCT_SEED, 60, TODAY);
    expect(rows.map(row => row.productId)).toEqual(['prod-006', 'prod-003', 'prod-008']);
    expect(mostUrgentLowStock(PRODUCT_SEED, 60, TODAY, 2)).toHaveSize(2);
  });

  it('gives the date the expiring window ends', () => {
    expect(expireByDate(TODAY, 60)).toBe('2026-11-20');
  });

  it('builds one needs-attention row with one action for each thing that needs attention', () => {
    const rows = buildNeedsAttention({
      needsRestock: 14,
      expiringBatches: 1,
      expireByDate: '2026-11-20',
      overdueOrders: 2,
      floatLow: true,
    });
    expect(rows.map(row => row.actionLabel)).toEqual(['Create PO', 'Review', 'Open', 'Top up']);
    expect(rows[0].message).toBe('Reorder 14 low-stock items');
    expect(rows[1].message).toBe('1 batch expire by 20 Nov');
    expect(rows[2].message).toBe('2 purchase orders overdue');
    expect(rows[1].queryParams).toEqual({ status: 'expiring-soon' });
    expect(rows[3].targetModule).toBe(ModuleKey.RELOAD_UTILITY);
  });

  it('builds no rows when nothing needs attention', () => {
    const rows = buildNeedsAttention({
      needsRestock: 0,
      expiringBatches: 0,
      expireByDate: '2026-11-20',
      overdueOrders: 0,
      floatLow: false,
    });
    expect(rows).toEqual([]);
  });

  it('labels only the highest day and today and makes the highest bar full height', () => {
    const bars = buildChartBars(SALES_SEED, 7, TODAY);
    expect(bars).toHaveSize(7);
    expect(bars.filter(bar => bar.showValue).map(bar => bar.date)).toEqual([
      '2026-09-18',
      '2026-09-21',
    ]);
    expect(bars.filter(bar => bar.isToday)).toHaveSize(1);
    expect(Math.max(...bars.map(bar => bar.heightPercent))).toBe(100);
  });

  it('caps the chart at 30 points and handles empty or zero data', () => {
    expect(buildChartBars(SALES_SEED, 500, TODAY)).toHaveSize(30);
    expect(buildChartBars([], 7, TODAY)).toEqual([]);
    const zero: DailySalesPoint[] = [{ date: TODAY, salesCents: 0, profitCents: 0, bills: 0 }];
    expect(buildChartBars(zero, 7, TODAY)[0].heightPercent).toBe(0);
  });

  it('formats the change against last week and the profit margin', () => {
    expect(formatSalesChange(8_425_000, 7_495_000)).toBe('+12.4%');
    expect(formatSalesChange(7_000_000, 8_000_000)).toBe('-12.5%');
    expect(formatSalesChange(100, 0)).toBe('');
    expect(formatProfitMargin(1_984_000, 8_425_000)).toBe('23.5%');
    expect(formatProfitMargin(0, 0)).toBe('0%');
  });
});
