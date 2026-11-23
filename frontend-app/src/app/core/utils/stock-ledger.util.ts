import { StockMovement } from '../models/domain/stock-movement.model';

export const PRODUCT_LEVEL_BATCH_ID = '';

export interface StockSums {
  byProduct: Map<string, number>;
  byBatch: Map<string, number>;
}

export function batchKey(productId: string, batchId: string): string {
  return `${productId}|${batchId}`;
}

export function sumMovements(movements: readonly StockMovement[]): StockSums {
  const byProduct = new Map<string, number>();
  const byBatch = new Map<string, number>();
  for (const movement of movements) {
    byProduct.set(movement.productId, (byProduct.get(movement.productId) ?? 0) + movement.qtyDelta);
    const key = batchKey(movement.productId, movement.batchId);
    byBatch.set(key, (byBatch.get(key) ?? 0) + movement.qtyDelta);
  }
  return { byProduct, byBatch };
}

export function mergeMovements(
  current: readonly StockMovement[],
  incoming: readonly StockMovement[]
): StockMovement[] {
  const merged = [...current];
  const known = new Set(current.map(movement => movement.id));
  for (const movement of incoming) {
    if (known.has(movement.id)) continue;
    known.add(movement.id);
    merged.push(movement);
  }
  return merged;
}
