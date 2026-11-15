import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Product } from '../models/domain/product.model';
import {
  MAX_SYNC_PRODUCTS,
  ProductSyncBatchRequest,
  ProductSyncBatchResponse,
  ProductSyncBatchResult,
  ProductSyncFailure,
  ProductSyncFailureReason,
  ProductSyncProgress,
  ProductSyncSuccess,
} from '../models/domain/product-sync.model';
import { splitIntoBatches } from '../utils/product-sync-batch.util';
import {
  applyServerRecord,
  buildSyncRecord,
  createProductFromServer,
  hasUnusableMatchKeys,
  productMatchKey,
} from '../utils/product-sync-merge.util';
import { isBatchResponseUsable } from '../utils/product-sync-validation.util';
import { ClockService } from './clock.service';
import { ProductDataService } from './data/product-data.service';
import { ProductSyncServer, ServerUnreachableError } from './data/product-sync-server';
import { ProductSyncStateStore } from './data/product-sync-state.store';
import { PosFailureResult } from './pos-sale.service';
import { PosWriteGuard } from './pos-write-guard.service';

export type ProductSyncResult = ProductSyncSuccess | ProductSyncFailure | PosFailureResult;
export type ProductSyncProgressHandler = (progress: ProductSyncProgress) => void;

export const SYNC_DENIED_MESSAGE = 'You do not have access to sync products at the till.';
export const SYNC_EMPTY_MESSAGE = 'There are no products to sync.';
export const SYNC_TOO_MANY_MESSAGE = 'There are too many products to sync in one run.';
export const SYNC_BAD_KEYS_MESSAGE =
  'Some products have a missing or repeated barcode and code. Fix them before syncing.';

type BatchOutcome = 'completed' | ProductSyncFailureReason;

function batchList(numbers: readonly number[]): string {
  return numbers.length === 0 ? 'none' : numbers.join(', ');
}

function failureMessage(
  reason: ProductSyncFailureReason,
  succeeded: readonly number[],
  failedBatch: number
): string {
  const lead =
    reason === 'unreachable'
      ? 'The server could not be reached.'
      : `Batch ${failedBatch} could not be synced.`;
  if (succeeded.length === 0) return `${lead} No batches were synced and nothing was changed.`;
  return `${lead} Synced batches: ${batchList(succeeded)}. Failed batch: ${failedBatch}.`;
}

@Injectable({ providedIn: 'root' })
export class PosProductSyncService {
  private readonly clockService = inject(ClockService);
  private readonly productDataService = inject(ProductDataService);
  private readonly productSyncServer = inject(ProductSyncServer);
  private readonly stateStore = inject(ProductSyncStateStore);
  private readonly writeGuard = inject(PosWriteGuard);

  sync(onProgress?: ProductSyncProgressHandler): Promise<ProductSyncResult> {
    return this.writeGuard.run('pos-product-sync', SYNC_DENIED_MESSAGE, () =>
      this.runSync(onProgress)
    );
  }

  private async runSync(
    onProgress: ProductSyncProgressHandler | undefined
  ): Promise<ProductSyncSuccess | ProductSyncFailure> {
    const products = await firstValueFrom(this.productDataService.getAll());
    const refusal = this.refuseUnsyncable(products);
    if (refusal !== null) return refusal;
    const batchIds = splitIntoBatches(products.map(product => product.id));
    const appMatchKeys = products.map(productMatchKey);
    const batches: ProductSyncBatchResult[] = batchIds.map((ids, index) => ({
      batchNumber: index + 1,
      productCount: ids.length,
      status: 'not-run',
    }));
    const succeeded: number[] = [];
    for (const [index, ids] of batchIds.entries()) {
      const request = { batchNumber: index + 1, totalBatches: batchIds.length };
      const final = index === batchIds.length - 1;
      const outcome = await this.runBatch(ids, request, final ? appMatchKeys : null);
      batches[index].status = outcome === 'completed' ? 'completed' : 'failed';
      if (outcome === 'completed') succeeded.push(index + 1);
      onProgress?.({
        completedBatches: succeeded.length,
        totalBatches: batchIds.length,
        batch: { ...batches[index] },
      });
      if (outcome !== 'completed') {
        return this.failure(outcome, products.length, batches, succeeded, index + 1);
      }
    }
    return this.success(products.length, batches);
  }

  private refuseUnsyncable(products: readonly Product[]): ProductSyncFailure | null {
    if (products.length === 0) return this.refusal('empty', SYNC_EMPTY_MESSAGE);
    if (products.length > MAX_SYNC_PRODUCTS) return this.refusal('invalid', SYNC_TOO_MANY_MESSAGE);
    if (hasUnusableMatchKeys(products)) return this.refusal('invalid', SYNC_BAD_KEYS_MESSAGE);
    return null;
  }

  private refusal(reason: ProductSyncFailureReason, message: string): ProductSyncFailure {
    return {
      ok: false,
      reason,
      message,
      totalProducts: 0,
      batchCount: 0,
      batches: [],
      succeededBatches: [],
      failedBatch: null,
    };
  }

  private success(total: number, batches: ProductSyncBatchResult[]): ProductSyncSuccess {
    const noun = batches.length === 1 ? 'batch' : 'batches';
    return {
      ok: true,
      totalProducts: total,
      batchCount: batches.length,
      batches,
      message: `Synced ${total} products in ${batches.length} ${noun}.`,
    };
  }

  private failure(
    reason: ProductSyncFailureReason,
    total: number,
    batches: ProductSyncBatchResult[],
    succeeded: number[],
    failedBatch: number
  ): ProductSyncFailure {
    return {
      ok: false,
      reason,
      message: failureMessage(reason, succeeded, failedBatch),
      totalProducts: total,
      batchCount: batches.length,
      batches,
      succeededBatches: [...succeeded],
      failedBatch,
    };
  }

  private async runBatch(
    ids: readonly string[],
    position: Pick<ProductSyncBatchRequest, 'batchNumber' | 'totalBatches'>,
    appMatchKeys: string[] | null
  ): Promise<BatchOutcome> {
    try {
      const sent = await this.currentProducts(ids);
      const records = sent.map(product =>
        buildSyncRecord(product, this.stateStore.get(productMatchKey(product)))
      );
      const request: ProductSyncBatchRequest = { ...position, records, appMatchKeys };
      const response = await firstValueFrom(this.productSyncServer.syncBatch(request));
      if (!isBatchResponseUsable(request, response)) return 'batch-failed';
      const saved = await this.applyResponse(ids, request, response);
      if (!saved) return 'batch-failed';
      sent.forEach((product, index) =>
        this.stateStore.confirm(productMatchKey(product), response.records[index].stockOnHand)
      );
      return 'completed';
    } catch (error) {
      return error instanceof ServerUnreachableError ? 'unreachable' : 'batch-failed';
    }
  }

  private async currentProducts(ids: readonly string[]): Promise<Product[]> {
    const all = await firstValueFrom(this.productDataService.getAll());
    const byId = new Map(all.map(product => [product.id, product]));
    return ids
      .map(id => byId.get(id))
      .filter((product): product is Product => product !== undefined);
  }

  private async applyResponse(
    ids: readonly string[],
    request: ProductSyncBatchRequest,
    response: ProductSyncBatchResponse
  ): Promise<boolean> {
    const latest = await this.currentProducts(ids);
    if (latest.length !== request.records.length) return false;
    const today = this.clockService.today();
    const updated = latest.map((product, index) =>
      applyServerRecord(product, response.records[index], request.records[index].stockOnHand, today)
    );
    const added = response.serverOnlyRecords.map(createProductFromServer);
    if (await this.addedProductsClash(added)) return false;
    await firstValueFrom(this.productDataService.saveAll(updated));
    for (const product of added) {
      await firstValueFrom(this.productDataService.save(product));
    }
    return true;
  }

  private async addedProductsClash(added: readonly Product[]): Promise<boolean> {
    if (added.length === 0) return false;
    const existing = await firstValueFrom(this.productDataService.getAll());
    const taken = new Set(existing.map(product => product.sku.trim().toLowerCase()));
    return added.some(product => {
      const sku = product.sku.trim().toLowerCase();
      const clash = taken.has(sku);
      taken.add(sku);
      return clash;
    });
  }
}
