import { Batch } from '../models/domain/batch.model';

export function sortBatchesByExpiry(batches: readonly Batch[]): Batch[] {
  const copy = batches.map(batch => ({ ...batch }));
  copy.sort((first, second) => first.expiryDate.localeCompare(second.expiryDate));
  return copy;
}

export function getEarliestBatchInStock(batches: readonly Batch[]): Batch | null {
  return sortBatchesByExpiry(batches).find(batch => batch.quantity > 0) ?? null;
}
