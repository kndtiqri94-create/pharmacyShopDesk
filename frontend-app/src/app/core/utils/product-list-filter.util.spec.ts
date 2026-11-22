import { Product } from '../models/domain/product.model';
import { ProductStatus } from '../models/enums/product-status.enum';
import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import {
  ProductListItem,
  countByStatus,
  filterItems,
  listCategories,
  normalizeSearch,
  parseStatusFilter,
  summarizeList,
  toListItems,
} from './product-list-filter.util';

const TODAY = '2026-09-21';
const items: ProductListItem[] = toListItems(PRODUCT_SEED, 60, TODAY);
const everything = { search: '', category: '', status: 'all' } as const;

describe('product-list-filter.util', () => {
  it('derives the status of the seed products', () => {
    const statusOf = (id: string) => items.find(item => item.product.id === id)?.status;
    expect(statusOf('prod-006')).toBe(ProductStatus.OUT_OF_STOCK);
    expect(statusOf('prod-003')).toBe(ProductStatus.LOW_STOCK);
    expect(statusOf('prod-002')).toBe(ProductStatus.EXPIRING_SOON);
    expect(statusOf('prod-001')).toBe(ProductStatus.IN_STOCK);
  });

  it('searches name, generic name, SKU and barcode ignoring case', () => {
    const find = (search: string) =>
      filterItems(items, { ...everything, search }).map(item => item.product.id);
    expect(find('PARACET')).toEqual(['prod-001']);
    expect(find('ascorbic')).toEqual(['prod-005']);
    expect(find('amx-500')).toEqual(['prod-002']);
    expect(find('4791000000103')).toEqual(['prod-010']);
    expect(find('no such thing')).toEqual([]);
  });

  it('filters by category and status together with search', () => {
    expect(filterItems(items, { ...everything, category: 'Diabetes' })).toHaveSize(1);
    const low = filterItems(items, { ...everything, status: 'low-stock' });
    expect(low.map(item => item.product.id)).toEqual(['prod-003', 'prod-008']);
    const matching = { search: 'met', category: 'Diabetes' };
    expect(filterItems(items, { ...matching, status: 'low-stock' })).toHaveSize(1);
    expect(filterItems(items, { ...matching, status: 'in-stock' })).toHaveSize(0);
  });

  it('counts each status for the current search and category', () => {
    expect(countByStatus(items, { search: '', category: '' })).toEqual({
      all: 10,
      'in-stock': 6,
      'low-stock': 2,
      'out-of-stock': 1,
      'expiring-soon': 1,
    });
    const category = countByStatus(items, { search: '', category: 'Diabetes' });
    expect(category.all).toBe(1);
    expect(category['low-stock']).toBe(1);
    expect(category['in-stock']).toBe(0);
  });

  it('summarizes totals for the page subtitle', () => {
    expect(summarizeList(items)).toEqual({ total: 10, needsRestock: 3, expiringSoon: 1 });
  });

  it('lists categories alphabetically without repeats', () => {
    const categories = listCategories(PRODUCT_SEED);
    expect(categories).toEqual([...categories].sort());
    expect(new Set(categories).size).toBe(categories.length);
  });

  it('falls back to all for an unknown status value', () => {
    expect(parseStatusFilter('low-stock')).toBe('low-stock');
    expect(parseStatusFilter('bogus')).toBe('all');
    expect(parseStatusFilter('__proto__')).toBe('all');
    expect(parseStatusFilter('toString')).toBe('all');
    expect(parseStatusFilter(null)).toBe('all');
  });

  it('trims and caps the search text', () => {
    expect(normalizeSearch('  AbC ')).toBe('abc');
    expect(normalizeSearch('x'.repeat(500))).toHaveSize(100);
  });

  it('shows Low stock for a low-stock product that also has a batch expiring soon', () => {
    const product: Product = {
      ...PRODUCT_SEED[0],
      reorderLevel: 5000,
      batches: [{ id: 'b', batchNo: 'B', expiryDate: '2026-10-01', quantity: 10, costCents: 1 }],
    };
    expect(toListItems([product], 60, TODAY)[0].status).toBe(ProductStatus.LOW_STOCK);
  });
});
