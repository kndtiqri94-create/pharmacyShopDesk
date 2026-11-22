import { Grn } from '../models/domain/grn.model';
import { PurchaseOrder } from '../models/domain/purchase-order.model';
import { Supplier } from '../models/domain/supplier.model';
import { GrnStatus } from '../models/enums/grn-status.enum';
import { PoStatus } from '../models/enums/po-status.enum';
import { formatRupees } from './money.util';
import { normalizeSearch } from './product-list-filter.util';
import { amountOwedToSupplier } from './supplier-owed.util';
import { pluralize } from './text.util';

export { SEARCH_MAX_LENGTH } from './product-list-filter.util';

export type SupplierFilter = 'all' | 'owing' | 'inactive';

export interface SupplierListItem {
  supplier: Supplier;
  owedCents: number;
  lastOrderDate: string | null;
}

export interface SupplierListCriteria {
  search: string;
  filter: SupplierFilter;
}

export type SupplierFilterCounts = Record<SupplierFilter, number>;

export interface SupplierSummary {
  activeCount: number;
  outstandingCents: number;
}

const SUPPLIER_FILTERS: readonly SupplierFilter[] = ['all', 'owing', 'inactive'];

export function parseSupplierFilter(value: string): SupplierFilter {
  return SUPPLIER_FILTERS.find(filter => filter === value) ?? 'all';
}

function latestDate(dates: readonly string[]): string | null {
  return dates.reduce<string | null>(
    (latest, date) => (latest === null || date > latest ? date : latest),
    null
  );
}

function lastOrderDateFor(
  supplierId: string,
  orders: readonly PurchaseOrder[],
  grns: readonly Grn[]
): string | null {
  const orderDates = orders
    .filter(order => order.supplierId === supplierId && order.status !== PoStatus.DRAFT)
    .map(order => order.orderDate);
  const fromOrders = latestDate(orderDates);
  if (fromOrders !== null) return fromOrders;
  return latestDate(
    grns
      .filter(grn => grn.supplierId === supplierId && grn.status === GrnStatus.RECEIVED)
      .map(grn => grn.receivedDate)
  );
}

export function toSupplierListItems(
  suppliers: readonly Supplier[],
  grns: readonly Grn[],
  orders: readonly PurchaseOrder[]
): SupplierListItem[] {
  return suppliers.map(supplier => ({
    supplier,
    owedCents: amountOwedToSupplier(grns, supplier.id),
    lastOrderDate: lastOrderDateFor(supplier.id, orders, grns),
  }));
}

function matchesSearch(item: SupplierListItem, term: string): boolean {
  if (term.length === 0) return true;
  return [item.supplier.name, item.supplier.contactPerson].some(field =>
    field.toLowerCase().includes(term)
  );
}

function matchesFilter(item: SupplierListItem, filter: SupplierFilter): boolean {
  if (filter === 'owing') return item.owedCents > 0;
  if (filter === 'inactive') return !item.supplier.active;
  return true;
}

export function filterSupplierItems(
  items: readonly SupplierListItem[],
  criteria: SupplierListCriteria
): SupplierListItem[] {
  const term = normalizeSearch(criteria.search);
  return items.filter(item => matchesSearch(item, term) && matchesFilter(item, criteria.filter));
}

export function countSupplierFilters(
  items: readonly SupplierListItem[],
  search: string
): SupplierFilterCounts {
  const scoped = filterSupplierItems(items, { search, filter: 'all' });
  return {
    all: scoped.length,
    owing: scoped.filter(item => item.owedCents > 0).length,
    inactive: scoped.filter(item => !item.supplier.active).length,
  };
}

export function summarizeSuppliers(items: readonly SupplierListItem[]): SupplierSummary {
  return {
    activeCount: items.filter(item => item.supplier.active).length,
    outstandingCents: items.reduce((total, item) => total + item.owedCents, 0),
  };
}

export function formatSupplierSubtitle(summary: SupplierSummary): string {
  return `${pluralize(summary.activeCount, 'active supplier')} · ${formatRupees(summary.outstandingCents)} outstanding`;
}
