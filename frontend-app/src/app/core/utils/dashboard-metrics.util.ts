import { Product } from '../models/domain/product.model';
import { DailySalesPoint } from '../models/domain/sales-summary.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { ProductStatus } from '../models/enums/product-status.enum';
import { addDays, daysBetween, formatDayMonth } from './date.util';
import { getProductStatus, getStockOnHand } from './stock-status.util';
import { formatPercent } from './money.util';
import { pluralize } from './text.util';

export const MAX_CHART_DAYS = 30;
export const LOW_STOCK_TABLE_LIMIT = 5;

export interface LowStockRow {
  productId: string;
  name: string;
  stock: number;
  reorderLevel: number;
  status: ProductStatus;
}

export interface StockAlertCounts {
  needsRestock: number;
  outOfStock: number;
  expiringBatches: number;
}

export interface NeedsAttentionRow {
  id: string;
  message: string;
  actionLabel: string;
  targetModule: ModuleKey;
  commands: readonly string[];
  queryParams: Record<string, string> | null;
  changesData: boolean;
  soft: boolean;
}

export interface NeedsAttentionInput {
  needsRestock: number;
  expiringBatches: number;
  expireByDate: string;
  overdueOrders: number;
  floatLow: boolean;
}

export interface ChartBar {
  date: string;
  salesCents: number;
  heightPercent: number;
  isToday: boolean;
  showValue: boolean;
}

const RESTOCK_STATUSES: readonly ProductStatus[] = [
  ProductStatus.LOW_STOCK,
  ProductStatus.OUT_OF_STOCK,
];

export function countExpiringBatches(
  products: readonly Product[],
  expiryAlertDays: number,
  today: string
): number {
  return products
    .filter(product => product.trackBatches)
    .flatMap(product => product.batches)
    .filter(batch => batch.quantity > 0 && daysBetween(today, batch.expiryDate) <= expiryAlertDays)
    .length;
}

export function computeStockAlertCounts(
  products: readonly Product[],
  expiryAlertDays: number,
  today: string
): StockAlertCounts {
  const statuses = products.map(product => getProductStatus(product, expiryAlertDays, today));
  return {
    needsRestock: statuses.filter(status => RESTOCK_STATUSES.includes(status)).length,
    outOfStock: statuses.filter(status => status === ProductStatus.OUT_OF_STOCK).length,
    expiringBatches: countExpiringBatches(products, expiryAlertDays, today),
  };
}

export function mostUrgentLowStock(
  products: readonly Product[],
  expiryAlertDays: number,
  today: string,
  limit = LOW_STOCK_TABLE_LIMIT
): LowStockRow[] {
  const rows = products
    .map(product => ({
      productId: product.id,
      name: product.name,
      stock: getStockOnHand(product),
      reorderLevel: product.reorderLevel,
      status: getProductStatus(product, expiryAlertDays, today),
    }))
    .filter(row => RESTOCK_STATUSES.includes(row.status));
  rows.sort((first, second) => first.stock - second.stock);
  return rows.slice(0, Math.max(0, limit));
}

export function expireByDate(today: string, expiryAlertDays: number): string {
  return addDays(today, expiryAlertDays);
}

export function buildNeedsAttention(input: NeedsAttentionInput): NeedsAttentionRow[] {
  const rows: NeedsAttentionRow[] = [];
  if (input.needsRestock > 0) {
    rows.push({
      id: 'low-stock',
      message: `Reorder ${pluralize(input.needsRestock, 'low-stock item')}`,
      actionLabel: 'Create PO',
      targetModule: ModuleKey.PURCHASE_ORDERS,
      commands: ['/purchase-orders'],
      queryParams: null,
      changesData: true,
      soft: true,
    });
  }
  if (input.expiringBatches > 0) {
    const batches = pluralize(input.expiringBatches, 'batch', 'batches');
    rows.push({
      id: 'expiring',
      message: `${batches} expire by ${formatDayMonth(input.expireByDate)}`,
      actionLabel: 'Review',
      targetModule: ModuleKey.PRODUCTS,
      commands: ['/products'],
      queryParams: { status: 'expiring-soon' },
      changesData: false,
      soft: false,
    });
  }
  if (input.overdueOrders > 0) {
    rows.push({
      id: 'overdue-orders',
      message: `${pluralize(input.overdueOrders, 'purchase order')} overdue`,
      actionLabel: 'Open',
      targetModule: ModuleKey.PURCHASE_ORDERS,
      commands: ['/purchase-orders'],
      queryParams: null,
      changesData: false,
      soft: false,
    });
  }
  if (input.floatLow) {
    rows.push({
      id: 'low-float',
      message: 'Reload float is running low',
      actionLabel: 'Top up',
      targetModule: ModuleKey.RELOAD_UTILITY,
      commands: ['/reload-utility'],
      queryParams: null,
      changesData: true,
      soft: false,
    });
  }
  return rows;
}

export function buildChartBars(
  points: readonly DailySalesPoint[],
  days: number,
  today: string
): ChartBar[] {
  const count = Math.min(Math.max(1, Math.floor(days)), MAX_CHART_DAYS);
  const visible = points.slice(-count);
  const highest = visible.reduce((max, point) => Math.max(max, point.salesCents), 0);
  const peakDate = visible.find(point => point.salesCents === highest)?.date;
  return visible.map(point => ({
    date: point.date,
    salesCents: point.salesCents,
    heightPercent: highest > 0 ? Math.round((point.salesCents / highest) * 100) : 0,
    isToday: point.date === today,
    showValue: point.date === today || point.date === peakDate,
  }));
}

export function formatSalesChange(currentCents: number, previousCents: number): string {
  if (previousCents <= 0) return '';
  const change = ((currentCents - previousCents) / previousCents) * 100;
  return `${change >= 0 ? '+' : ''}${formatPercent(change)}`;
}

export function formatProfitMargin(profitCents: number, salesCents: number): string {
  return salesCents > 0 ? formatPercent((profitCents / salesCents) * 100) : formatPercent(0);
}
