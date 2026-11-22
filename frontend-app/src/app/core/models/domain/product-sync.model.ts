export const PRODUCT_SYNC_BATCH_SIZE = 500;
export const MAX_SYNC_PRODUCTS = 50_000;
export const MAX_SERVER_ONLY_PRODUCTS = 5_000;
export const MAX_SYNC_NAME_LENGTH = 200;
export const MAX_SYNC_TEXT_LENGTH = 100;
export const MAX_SYNC_MATCH_KEY_LENGTH = 64;
export const MAX_SYNC_CENTS = 100_000_000_000;
export const MAX_SYNC_STOCK = 10_000_000;

export interface ProductSyncServerRecord {
  matchKey: string;
  name: string;
  category: string;
  unit: string;
  priceCents: number;
  costCents: number;
  stockOnHand: number;
  active: boolean;
}

export interface ProductSyncRecord extends ProductSyncServerRecord {
  stockDelta: number;
  operationId: string;
}

export interface ProductSyncBatchRequest {
  batchNumber: number;
  totalBatches: number;
  records: ProductSyncRecord[];
  appMatchKeys: string[] | null;
}

export interface ProductSyncBatchResponse {
  batchNumber: number;
  records: ProductSyncServerRecord[];
  serverOnlyRecords: ProductSyncServerRecord[];
}

export type BatchStatus = 'completed' | 'failed' | 'not-run';

export interface ProductSyncBatchResult {
  batchNumber: number;
  productCount: number;
  status: BatchStatus;
}

export interface ProductSyncProgress {
  completedBatches: number;
  totalBatches: number;
  batch: ProductSyncBatchResult;
}

export type ProductSyncFailureReason = 'empty' | 'invalid' | 'unreachable' | 'batch-failed';

export interface ProductSyncSuccess {
  ok: true;
  totalProducts: number;
  batchCount: number;
  batches: ProductSyncBatchResult[];
  message: string;
}

export interface ProductSyncFailure {
  ok: false;
  reason: ProductSyncFailureReason;
  message: string;
  totalProducts: number;
  batchCount: number;
  batches: ProductSyncBatchResult[];
  succeededBatches: number[];
  failedBatch: number | null;
}
