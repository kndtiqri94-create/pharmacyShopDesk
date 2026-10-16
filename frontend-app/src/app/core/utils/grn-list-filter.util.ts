import { Grn } from '../models/domain/grn.model';
import { PurchaseOrder } from '../models/domain/purchase-order.model';
import { Supplier } from '../models/domain/supplier.model';
import { GrnStatus } from '../models/enums/grn-status.enum';
import { PoStatus } from '../models/enums/po-status.enum';
import { daysBetween, endOfMonth, startOfMonth } from './date.util';
import { formatCount, formatRupees } from './money.util';
import { normalizeSearch } from './product-list-filter.util';
import { summarizeUnpaid } from './supplier-owed.util';
import { pluralize } from './text.util';

export { SEARCH_MAX_LENGTH } from './product-list-filter.util';

export const EXPECTED_SOON_DAYS = 7;
export const NO_PO_LABEL = 'No PO';

export type GrnStatusFilter = 'all' | 'draft' | 'received' | 'cancelled';

export const GRN_FILTER_TO_STATUS: Record<Exclude<GrnStatusFilter, 'all'>, GrnStatus> = {
  draft: GrnStatus.DRAFT,
  received: GrnStatus.RECEIVED,
  cancelled: GrnStatus.CANCELLED,
};

export interface DateRange {
  from: string;
  to: string;
}

export interface GrnListItem {
  grn: Grn;
  supplierName: string;
  reference: string;
  itemCount: number;
}

export interface GrnListCriteria {
  search: string;
  status: GrnStatusFilter;
  range: DateRange;
}

export type GrnStatusCounts = Record<GrnStatusFilter, number>;

export interface GrnSummaryTiles {
  receivedValue: string;
  receivedNote: string;
  waitingValue: string;
  waitingNote: string;
  unpaidValue: string;
  unpaidNote: string;
}

export function parseGrnStatusFilter(value: string | null): GrnStatusFilter {
  return value !== null && Object.hasOwn(GRN_FILTER_TO_STATUS, value)
    ? (value as GrnStatusFilter)
    : 'all';
}

export function monthRange(today: string): DateRange {
  return { from: startOfMonth(today), to: endOfMonth(today) };
}

export function isInRange(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

export function formatReference(grn: Grn): string {
  return grn.purchaseOrderNumber === null
    ? `${grn.invoiceNo || '–'} / ${NO_PO_LABEL}`
    : `${grn.invoiceNo || '–'} / ${grn.purchaseOrderNumber}`;
}

export function toGrnListItems(
  grns: readonly Grn[],
  suppliers: readonly Supplier[]
): GrnListItem[] {
  const items = grns.map(grn => ({
    grn,
    supplierName: suppliers.find(supplier => supplier.id === grn.supplierId)?.name ?? '',
    reference: formatReference(grn),
    itemCount: grn.lines.length,
  }));
  items.sort(
    (first, second) =>
      second.grn.receivedDate.localeCompare(first.grn.receivedDate) ||
      second.grn.number.localeCompare(first.grn.number)
  );
  return items;
}

function matchesSearch(item: GrnListItem, term: string): boolean {
  if (term.length === 0) return true;
  return [item.grn.number, item.grn.invoiceNo, item.supplierName].some(field =>
    field.toLowerCase().includes(term)
  );
}

function matchesRange(item: GrnListItem, range: DateRange): boolean {
  return item.grn.status === GrnStatus.DRAFT || isInRange(item.grn.receivedDate, range);
}

function matchesStatus(item: GrnListItem, status: GrnStatusFilter): boolean {
  return status === 'all' || item.grn.status === GRN_FILTER_TO_STATUS[status];
}

export function filterGrnItems(
  items: readonly GrnListItem[],
  criteria: GrnListCriteria
): GrnListItem[] {
  const term = normalizeSearch(criteria.search);
  return items.filter(
    item =>
      matchesSearch(item, term) &&
      matchesRange(item, criteria.range) &&
      matchesStatus(item, criteria.status)
  );
}

export function countGrnByStatus(
  items: readonly GrnListItem[],
  criteria: Pick<GrnListCriteria, 'search' | 'range'>
): GrnStatusCounts {
  const scoped = filterGrnItems(items, { ...criteria, status: 'all' });
  const countOf = (status: GrnStatus) => scoped.filter(item => item.grn.status === status).length;
  return {
    all: scoped.length,
    draft: countOf(GrnStatus.DRAFT),
    received: countOf(GrnStatus.RECEIVED),
    cancelled: countOf(GrnStatus.CANCELLED),
  };
}

export function countOrdersExpectedSoon(orders: readonly PurchaseOrder[], today: string): number {
  return orders.filter(order => daysBetween(today, order.expectedDate) <= EXPECTED_SOON_DAYS)
    .length;
}

export function waitingOrders(orders: readonly PurchaseOrder[]): PurchaseOrder[] {
  return orders.filter(
    order => order.status === PoStatus.SENT || order.status === PoStatus.PART_RECEIVED
  );
}

export function summarizeGrns(
  grns: readonly Grn[],
  orders: readonly PurchaseOrder[],
  today: string
): GrnSummaryTiles {
  const range = monthRange(today);
  const received = grns.filter(
    grn => grn.status === GrnStatus.RECEIVED && isInRange(grn.receivedDate, range)
  );
  const supplierCount = new Set(received.map(grn => grn.supplierId)).size;
  const waiting = waitingOrders(orders);
  const unpaid = summarizeUnpaid(grns, today);
  return {
    receivedValue: formatRupees(received.reduce((total, grn) => total + grn.totalCents, 0)),
    receivedNote: `${pluralize(received.length, 'GRN')} from ${pluralize(supplierCount, 'supplier')}`,
    waitingValue: pluralize(waiting.length, 'PO'),
    waitingNote: `Expected within ${EXPECTED_SOON_DAYS} days: ${formatCount(countOrdersExpectedSoon(waiting, today))}`,
    unpaidValue: formatRupees(unpaid.totalCents),
    unpaidNote: `${pluralize(unpaid.invoiceCount, 'invoice')} · oldest ${pluralize(unpaid.oldestDays, 'day')}`,
  };
}
