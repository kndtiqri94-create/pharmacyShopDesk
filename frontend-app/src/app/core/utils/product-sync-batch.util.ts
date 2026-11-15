import { PRODUCT_SYNC_BATCH_SIZE } from '../models/domain/product-sync.model';

export function splitIntoBatches<T>(
  items: readonly T[],
  batchSize: number = PRODUCT_SYNC_BATCH_SIZE
): T[][] {
  const size = Math.max(1, Math.floor(batchSize));
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size));
  }
  return batches;
}
