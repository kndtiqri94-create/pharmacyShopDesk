import { Product } from '../models/domain/product.model';
import { getEarliestBatchInStock } from './batch-order.util';
import { formatExpiry } from './date.util';

export const EMPTY_CELL = '–';

export function formatBatchExpiry(product: Product): string {
  if (!product.trackBatches) return EMPTY_CELL;
  const batch = getEarliestBatchInStock(product.batches);
  return batch ? `${batch.batchNo} / Exp ${formatExpiry(batch.expiryDate)}` : EMPTY_CELL;
}

export function formatProductDetails(product: Product): string {
  return [product.category, product.genericName, product.form]
    .filter(part => part.length > 0)
    .join(' · ');
}

export function formatUnitPlural(unit: string): string {
  return `${unit}s`;
}
