import { Injectable } from '@angular/core';
import { Observable, defer, of } from 'rxjs';
import {
  PRODUCT_SYNC_BATCH_SIZE,
  ProductSyncBatchRequest,
  ProductSyncBatchResponse,
  ProductSyncRecord,
  ProductSyncServerRecord,
} from '../../../models/domain/product-sync.model';
import { cloneValue } from '../../../utils/clone.util';
import { isValidServerRecord } from '../../../utils/product-sync-validation.util';
import {
  BatchFailedError,
  ProductSyncServer,
  ServerUnreachableError,
} from '../product-sync-server';
import { PRODUCT_SYNC_SERVER_SEED } from './seed/product-sync-server.seed';

interface AppliedOperation {
  stockDelta: number;
  resultingStock: number;
}

@Injectable()
export class InMemoryProductSyncServer extends ProductSyncServer {
  private readonly products = new Map<string, ProductSyncServerRecord>(
    cloneValue([...PRODUCT_SYNC_SERVER_SEED]).map(record => [record.matchKey, record])
  );
  private readonly appliedOperations = new Map<string, AppliedOperation>();
  private unreachable = false;
  private failingBatch: number | null = null;
  private failingBatchAfterApply: number | null = null;

  syncBatch(request: ProductSyncBatchRequest): Observable<ProductSyncBatchResponse> {
    return defer(() => {
      if (this.unreachable) throw new ServerUnreachableError();
      if (request.batchNumber === this.failingBatch) throw new BatchFailedError();
      this.assertRequestUsable(request);
      const records = request.records.map(record => this.applyRecord(record));
      const serverOnlyRecords = this.serverOnlyFor(request);
      if (request.batchNumber === this.failingBatchAfterApply) throw new BatchFailedError();
      return of({ batchNumber: request.batchNumber, records, serverOnlyRecords });
    });
  }

  simulateUnreachable(unreachable: boolean): void {
    this.unreachable = unreachable;
  }

  simulateFailingBatch(batchNumber: number | null): void {
    this.failingBatch = batchNumber;
  }

  simulateFailureAfterApply(batchNumber: number | null): void {
    this.failingBatchAfterApply = batchNumber;
  }

  getRecord(matchKey: string): ProductSyncServerRecord | null {
    const record = this.products.get(matchKey);
    return record === undefined ? null : cloneValue(record);
  }

  recordCount(): number {
    return this.products.size;
  }

  private assertRequestUsable(request: ProductSyncBatchRequest): void {
    const wellFormed =
      Array.isArray(request.records) &&
      request.records.length <= PRODUCT_SYNC_BATCH_SIZE &&
      request.records.every(
        record =>
          isValidServerRecord(record) &&
          Number.isInteger(record.stockDelta) &&
          record.operationId.length > 0
      );
    if (!wellFormed) throw new BatchFailedError();
  }

  private applyRecord(record: ProductSyncRecord): ProductSyncServerRecord {
    const existing = this.products.get(record.matchKey);
    const applied = this.appliedOperations.get(record.operationId);
    if (applied !== undefined) {
      if (applied.stockDelta !== record.stockDelta) throw new BatchFailedError();
      return this.withStock(existing ?? record, applied.resultingStock);
    }
    const baseStock = existing === undefined ? record.stockOnHand : existing.stockOnHand;
    const resultingStock = Math.max(
      0,
      baseStock + (existing === undefined ? 0 : record.stockDelta)
    );
    this.appliedOperations.set(record.operationId, {
      stockDelta: record.stockDelta,
      resultingStock,
    });
    const stored = existing ?? this.toServerRecord(record);
    const updated = this.withStock(stored, resultingStock);
    this.products.set(record.matchKey, updated);
    return cloneValue(updated);
  }

  private serverOnlyFor(request: ProductSyncBatchRequest): ProductSyncServerRecord[] {
    if (request.appMatchKeys === null) return [];
    const appKeys = new Set(request.appMatchKeys);
    return [...this.products.values()]
      .filter(record => !appKeys.has(record.matchKey))
      .map(record => cloneValue(record));
  }

  private toServerRecord(record: ProductSyncRecord): ProductSyncServerRecord {
    return {
      matchKey: record.matchKey,
      name: record.name,
      category: record.category,
      unit: record.unit,
      priceCents: record.priceCents,
      costCents: record.costCents,
      stockOnHand: record.stockOnHand,
      active: record.active,
    };
  }

  private withStock(record: ProductSyncServerRecord, stockOnHand: number): ProductSyncServerRecord {
    return {
      matchKey: record.matchKey,
      name: record.name,
      category: record.category,
      unit: record.unit,
      priceCents: record.priceCents,
      costCents: record.costCents,
      stockOnHand,
      active: record.active,
    };
  }
}
