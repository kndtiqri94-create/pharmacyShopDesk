import { GRN_SEED } from '../services/data/in-memory/seed/grn.seed';
import { PURCHASE_ORDER_SEED } from '../services/data/in-memory/seed/purchase-order.seed';
import { SUPPLIER_SEED } from '../services/data/in-memory/seed/supplier.seed';
import {
  countSupplierFilters,
  filterSupplierItems,
  formatSupplierSubtitle,
  parseSupplierFilter,
  summarizeSuppliers,
  toSupplierListItems,
} from './supplier-list-filter.util';

describe('supplier-list-filter.util', () => {
  const items = toSupplierListItems(SUPPLIER_SEED, GRN_SEED, PURCHASE_ORDER_SEED);

  it('derives what each supplier is owed from GRNs', () => {
    const owed = Object.fromEntries(items.map(item => [item.supplier.id, item.owedCents]));
    expect(owed).toEqual({
      'sup-001': 1_160_000,
      'sup-002': 0,
      'sup-003': 280_000,
      'sup-004': 0,
      'sup-005': 0,
    });
  });

  it('uses the latest placed order date and falls back to the latest GRN', () => {
    const dates = Object.fromEntries(items.map(item => [item.supplier.id, item.lastOrderDate]));
    expect(dates['sup-001']).toBe('2026-09-10');
    expect(dates['sup-002']).toBe('2026-09-12');
    expect(dates['sup-003']).toBe('2026-09-14');
    expect(dates['sup-005']).toBeNull();
  });

  it('searches name or contact person ignoring case and surrounding spaces', () => {
    const search = (text: string) =>
      filterSupplierItems(items, { search: text, filter: 'all' }).map(item => item.supplier.id);
    expect(search('  CITY ')).toEqual(['sup-002']);
    expect(search('ishara')).toEqual(['sup-005']);
    expect(search('zzz')).toEqual([]);
    expect(search('')).toHaveSize(5);
  });

  it('limits the search text to 100 characters', () => {
    const result = filterSupplierItems(items, { search: `${'x'.repeat(150)}`, filter: 'all' });
    expect(result).toEqual([]);
  });

  it('filters by Owing and Inactive', () => {
    const ids = (filter: 'owing' | 'inactive') =>
      filterSupplierItems(items, { search: '', filter }).map(item => item.supplier.id);
    expect(ids('owing')).toEqual(['sup-001', 'sup-003']);
    expect(ids('inactive')).toEqual(['sup-005']);
  });

  it('counts the chips live and reflects the search', () => {
    expect(countSupplierFilters(items, '')).toEqual({ all: 5, owing: 2, inactive: 1 });
    expect(countSupplierFilters(items, 'lanka')).toEqual({ all: 1, owing: 1, inactive: 0 });
  });

  it('gives a subtitle whose total equals the sum of the Owing column', () => {
    const summary = summarizeSuppliers(items);
    expect(summary).toEqual({ activeCount: 4, outstandingCents: 1_440_000 });
    expect(summary.outstandingCents).toBe(items.reduce((sum, item) => sum + item.owedCents, 0));
    expect(formatSupplierSubtitle(summary)).toBe('4 active suppliers · Rs. 14,400 outstanding');
    expect(formatSupplierSubtitle({ activeCount: 1, outstandingCents: 0 })).toBe(
      '1 active supplier · Rs. 0 outstanding'
    );
  });

  it('falls back to All for an unknown filter', () => {
    expect(parseSupplierFilter('owing')).toBe('owing');
    expect(parseSupplierFilter('<script>')).toBe('all');
  });
});
