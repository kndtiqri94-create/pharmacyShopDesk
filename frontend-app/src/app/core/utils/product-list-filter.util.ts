import { Product } from '../models/domain/product.model';
import { ProductStatus } from '../models/enums/product-status.enum';
import { getProductStatus, getStockOnHand } from './stock-status.util';

export const SEARCH_MAX_LENGTH = 100;
export const ALL_CATEGORIES = '';

export type StatusFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock' | 'expiring-soon';

export const STATUS_FILTER_TO_STATUS: Record<Exclude<StatusFilter, 'all'>, ProductStatus> = {
  'in-stock': ProductStatus.IN_STOCK,
  'low-stock': ProductStatus.LOW_STOCK,
  'out-of-stock': ProductStatus.OUT_OF_STOCK,
  'expiring-soon': ProductStatus.EXPIRING_SOON,
};

export interface ProductListItem {
  product: Product;
  status: ProductStatus;
  stock: number;
}

export interface ProductListCriteria {
  search: string;
  category: string;
  status: StatusFilter;
}

export type StatusCounts = Record<StatusFilter, number>;

export interface ProductListSummary {
  total: number;
  needsRestock: number;
  expiringSoon: number;
}

export function parseStatusFilter(value: string | null): StatusFilter {
  return value !== null && Object.hasOwn(STATUS_FILTER_TO_STATUS, value)
    ? (value as StatusFilter)
    : 'all';
}

export function normalizeSearch(text: string): string {
  return text.trim().slice(0, SEARCH_MAX_LENGTH).toLowerCase();
}

export function toListItems(
  products: readonly Product[],
  expiryAlertDays: number,
  today: string
): ProductListItem[] {
  return products.map(product => ({
    product,
    status: getProductStatus(product, expiryAlertDays, today),
    stock: getStockOnHand(product),
  }));
}

export function listCategories(products: readonly Product[]): string[] {
  const categories = Array.from(new Set(products.map(product => product.category)));
  categories.sort((first, second) => first.localeCompare(second));
  return categories;
}

function matchesSearch(item: ProductListItem, term: string): boolean {
  if (term.length === 0) return true;
  const { name, genericName, sku, barcode } = item.product;
  return [name, genericName, sku, barcode].some(field => field.toLowerCase().includes(term));
}

function matchesCategory(item: ProductListItem, category: string): boolean {
  return category === ALL_CATEGORIES || item.product.category === category;
}

function matchesStatus(item: ProductListItem, status: StatusFilter): boolean {
  return status === 'all' || item.status === STATUS_FILTER_TO_STATUS[status];
}

export function filterItems(
  items: readonly ProductListItem[],
  criteria: ProductListCriteria
): ProductListItem[] {
  const term = normalizeSearch(criteria.search);
  return items.filter(
    item =>
      matchesSearch(item, term) &&
      matchesCategory(item, criteria.category) &&
      matchesStatus(item, criteria.status)
  );
}

export function countByStatus(
  items: readonly ProductListItem[],
  criteria: Pick<ProductListCriteria, 'search' | 'category'>
): StatusCounts {
  const scoped = filterItems(items, { ...criteria, status: 'all' });
  const countOf = (status: ProductStatus) => scoped.filter(item => item.status === status).length;
  return {
    all: scoped.length,
    'in-stock': countOf(ProductStatus.IN_STOCK),
    'low-stock': countOf(ProductStatus.LOW_STOCK),
    'out-of-stock': countOf(ProductStatus.OUT_OF_STOCK),
    'expiring-soon': countOf(ProductStatus.EXPIRING_SOON),
  };
}

export function summarizeList(items: readonly ProductListItem[]): ProductListSummary {
  const countOf = (...statuses: ProductStatus[]) =>
    items.filter(item => statuses.includes(item.status)).length;
  return {
    total: items.length,
    needsRestock: countOf(ProductStatus.LOW_STOCK, ProductStatus.OUT_OF_STOCK),
    expiringSoon: countOf(ProductStatus.EXPIRING_SOON),
  };
}
