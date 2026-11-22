import { PurchaseOrder } from '../models/domain/purchase-order.model';
import { Supplier } from '../models/domain/supplier.model';
import { PoStatus } from '../models/enums/po-status.enum';
import { addDays, formatDayMonth } from './date.util';
import { DateRange, isInRange } from './grn-list-filter.util';
import { normalizeSearch } from './product-list-filter.util';
import { isPurchaseOrderOverdue } from './purchase-order-overdue.util';

export { SEARCH_MAX_LENGTH } from './product-list-filter.util';

export const RECENT_ORDER_DAYS = 30;

export type PoStatusFilter = 'all' | 'draft' | 'sent' | 'part-received' | 'received' | 'cancelled';

export const PO_FILTER_TO_STATUS: Record<Exclude<PoStatusFilter, 'all'>, PoStatus> = {
  draft: PoStatus.DRAFT,
  sent: PoStatus.SENT,
  'part-received': PoStatus.PART_RECEIVED,
  received: PoStatus.RECEIVED,
  cancelled: PoStatus.CANCELLED,
};

export interface PurchaseOrderListItem {
  order: PurchaseOrder;
  supplierName: string;
  contactSummary: string;
  itemCount: number;
  overdue: boolean;
  expectedLabel: string;
}

export interface PurchaseOrderListCriteria {
  search: string;
  status: PoStatusFilter;
  range: DateRange;
}

export type PoStatusCounts = Record<PoStatusFilter, number>;

export function parsePoStatusFilter(value: string | null): PoStatusFilter {
  return value !== null && Object.hasOwn(PO_FILTER_TO_STATUS, value)
    ? (value as PoStatusFilter)
    : 'all';
}

export function recentRange(today: string): DateRange {
  return { from: addDays(today, -RECENT_ORDER_DAYS), to: today };
}

export function formatExpectedLabel(order: PurchaseOrder, today: string): string {
  if (order.expectedDate === '') return '–';
  const day = formatDayMonth(order.expectedDate);
  return isPurchaseOrderOverdue(order, today) ? `${day} · overdue` : day;
}

export function toPurchaseOrderListItems(
  orders: readonly PurchaseOrder[],
  suppliers: readonly Supplier[],
  today: string
): PurchaseOrderListItem[] {
  const items = orders.map(order => {
    const supplier = suppliers.find(candidate => candidate.id === order.supplierId);
    return {
      order,
      supplierName: supplier?.name ?? '',
      contactSummary: supplier ? `Contact: ${supplier.contactPerson}` : '',
      itemCount: order.lines.length,
      overdue: isPurchaseOrderOverdue(order, today),
      expectedLabel: formatExpectedLabel(order, today),
    };
  });
  items.sort(
    (first, second) =>
      second.order.orderDate.localeCompare(first.order.orderDate) ||
      second.order.number.localeCompare(first.order.number)
  );
  return items;
}

function matchesSearch(item: PurchaseOrderListItem, term: string): boolean {
  if (term.length === 0) return true;
  return [item.order.number, item.supplierName].some(field => field.toLowerCase().includes(term));
}

function matchesRange(item: PurchaseOrderListItem, range: DateRange): boolean {
  return item.order.status === PoStatus.DRAFT || isInRange(item.order.orderDate, range);
}

function matchesStatus(item: PurchaseOrderListItem, status: PoStatusFilter): boolean {
  return status === 'all' || item.order.status === PO_FILTER_TO_STATUS[status];
}

export function filterPurchaseOrderItems(
  items: readonly PurchaseOrderListItem[],
  criteria: PurchaseOrderListCriteria
): PurchaseOrderListItem[] {
  const term = normalizeSearch(criteria.search);
  return items.filter(
    item =>
      matchesSearch(item, term) &&
      matchesRange(item, criteria.range) &&
      matchesStatus(item, criteria.status)
  );
}

export function countPurchaseOrdersByStatus(
  items: readonly PurchaseOrderListItem[],
  criteria: Pick<PurchaseOrderListCriteria, 'search' | 'range'>
): PoStatusCounts {
  const scoped = filterPurchaseOrderItems(items, { ...criteria, status: 'all' });
  const countOf = (status: PoStatus) => scoped.filter(item => item.order.status === status).length;
  return {
    all: scoped.length,
    draft: countOf(PoStatus.DRAFT),
    sent: countOf(PoStatus.SENT),
    'part-received': countOf(PoStatus.PART_RECEIVED),
    received: countOf(PoStatus.RECEIVED),
    cancelled: countOf(PoStatus.CANCELLED),
  };
}

export function countOverdueOrders(items: readonly PurchaseOrderListItem[]): number {
  return items.filter(item => item.overdue).length;
}
