import { Batch } from '../models/domain/batch.model';
import { Product } from '../models/domain/product.model';
import { SaleLine } from '../models/domain/sale-line.model';
import { ReturnAllocation } from '../models/domain/sale-return.model';
import { sortBatchesByExpiry } from './batch-order.util';
import { isBatchExpired } from './pos-stock-allocation.util';

export interface RestockInput {
  product: Product;
  saleLine: SaleLine;
  priorAllocations: readonly ReturnAllocation[];
  quantity: number;
  today: string;
  blockExpired: boolean;
}

export type RestockResult =
  { ok: true; product: Product; allocations: ReturnAllocation[] } | { ok: false; message: string };

function usesBatches(product: Product): boolean {
  return product.trackBatches && product.batches.length > 0;
}

function restockable(batch: Batch, input: RestockInput): boolean {
  return !(input.blockExpired && isBatchExpired(batch, input.today));
}

function restoredToBatch(input: RestockInput, batchId: string | null): number {
  return input.priorAllocations
    .filter(allocation => allocation.batchId === batchId)
    .reduce((total, allocation) => total + allocation.quantity, 0);
}

function addToBatch(
  batches: Batch[],
  batch: Batch,
  quantity: number,
  allocations: ReturnAllocation[]
): void {
  const index = batches.findIndex(candidate => candidate.id === batch.id);
  batches[index] = { ...batches[index], quantity: batches[index].quantity + quantity };
  const existing = allocations.find(allocation => allocation.batchId === batch.id);
  if (existing) {
    existing.quantity += quantity;
    return;
  }
  allocations.push({
    batchId: batch.id,
    batchNo: batch.batchNo,
    quantity,
    costCents: batch.costCents,
  });
}

function restockWithoutBatches(input: RestockInput): RestockResult {
  const { product, saleLine, quantity } = input;
  const costCents = saleLine.batchAllocations[0]?.costCents ?? product.costCents;
  return {
    ok: true,
    product: {
      ...product,
      batches: product.batches.map(batch => ({ ...batch })),
      stockOnHand: product.stockOnHand + quantity,
    },
    allocations: [{ batchId: null, batchNo: '', quantity, costCents }],
  };
}

export function restockReturnLine(input: RestockInput): RestockResult {
  const { product, saleLine, quantity } = input;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, message: `Enter a whole quantity for ${product.name}.` };
  }
  if (!usesBatches(product)) return restockWithoutBatches(input);
  const batches = sortBatchesByExpiry(product.batches);
  const allocations: ReturnAllocation[] = [];
  let remaining = quantity;
  for (const original of saleLine.batchAllocations) {
    if (remaining === 0) break;
    const batch = batches.find(candidate => candidate.id === original.batchId);
    if (batch === undefined || !restockable(batch, input)) continue;
    const capacity = original.quantity - restoredToBatch(input, original.batchId);
    const put = Math.min(remaining, Math.max(0, capacity));
    if (put > 0) {
      addToBatch(batches, batch, put, allocations);
      remaining -= put;
    }
  }
  if (remaining > 0) {
    const first = batches.find(candidate => restockable(candidate, input));
    if (first === undefined) {
      return { ok: false, message: `There is no batch to put ${product.name} back into.` };
    }
    addToBatch(batches, first, remaining, allocations);
  }
  return { ok: true, product: { ...product, batches }, allocations };
}
