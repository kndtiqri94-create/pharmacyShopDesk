import { Batch } from '../models/domain/batch.model';
import { BatchAllocation } from '../models/domain/sale-line.model';
import { Product } from '../models/domain/product.model';
import { sortBatchesByExpiry } from './batch-order.util';
import { getStockOnHand } from './stock-status.util';

export interface SellableStock {
  totalQuantity: number;
  sellableQuantity: number;
}

export type StockAllocationResult =
  | { ok: true; allocations: BatchAllocation[]; product: Product }
  | { ok: false; availableQuantity: number };

function usesBatches(product: Product): boolean {
  return product.trackBatches && product.batches.length > 0;
}

export function isBatchExpired(batch: Batch, today: string): boolean {
  return batch.expiryDate !== '' && batch.expiryDate < today;
}

function sellableBatches(product: Product, today: string, blockExpired: boolean): Batch[] {
  return sortBatchesByExpiry(product.batches).filter(
    batch => batch.quantity > 0 && !(blockExpired && isBatchExpired(batch, today))
  );
}

export function getSellableStock(
  product: Product,
  today: string,
  blockExpired: boolean
): SellableStock {
  const totalQuantity = Math.max(0, getStockOnHand(product));
  if (!usesBatches(product)) return { totalQuantity, sellableQuantity: totalQuantity };
  const sellableQuantity = sellableBatches(product, today, blockExpired).reduce(
    (total, batch) => total + batch.quantity,
    0
  );
  return { totalQuantity, sellableQuantity };
}

export function allocateStock(
  product: Product,
  quantity: number,
  today: string,
  blockExpired: boolean
): StockAllocationResult {
  const { sellableQuantity } = getSellableStock(product, today, blockExpired);
  const validQuantity = Number.isInteger(quantity) && quantity > 0;
  if (!validQuantity || quantity > sellableQuantity) {
    return { ok: false, availableQuantity: sellableQuantity };
  }
  if (!usesBatches(product)) {
    return {
      ok: true,
      allocations: [{ batchId: null, batchNo: '', quantity, costCents: product.costCents }],
      product: {
        ...product,
        batches: product.batches.map(batch => ({ ...batch })),
        stockOnHand: product.stockOnHand - quantity,
      },
    };
  }
  return allocateFromBatches(product, quantity, today, blockExpired);
}

function allocateFromBatches(
  product: Product,
  quantity: number,
  today: string,
  blockExpired: boolean
): StockAllocationResult {
  const eligible = new Set(sellableBatches(product, today, blockExpired).map(batch => batch.id));
  const allocations: BatchAllocation[] = [];
  let remaining = quantity;
  const batches = sortBatchesByExpiry(product.batches).map(batch => {
    if (remaining === 0 || !eligible.has(batch.id)) return batch;
    const taken = Math.min(batch.quantity, remaining);
    remaining -= taken;
    allocations.push({
      batchId: batch.id,
      batchNo: batch.batchNo,
      quantity: taken,
      costCents: batch.costCents,
    });
    return { ...batch, quantity: batch.quantity - taken };
  });
  return { ok: true, allocations, product: { ...product, batches } };
}
