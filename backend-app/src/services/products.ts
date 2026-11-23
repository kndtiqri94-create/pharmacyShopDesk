import { randomUUID } from 'node:crypto';
import { COLLECTION_BY_NAME } from '../domain/collections.js';
import { validationError } from '../errors.js';
import { JsonObject, NewMovement, StockSum, Tx } from '../store/types.js';
import { parseRecord, upsertRecord, WriteResult } from './records.js';

export const PRODUCT_LEVEL_BATCH_ID = '';
export const SERVER_DEVICE_CODE = 'SRV';
const PRODUCTS = 'products';

interface BatchData {
  id: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  costCents: number;
}

export interface ProductData extends JsonObject {
  id: string;
  sku: string;
  barcode: string;
  trackBatches: boolean;
  stockOnHand: number;
  batches: BatchData[];
}

export interface SumIndex {
  byProduct: Map<string, number>;
  byBatch: Map<string, number>;
}

export const batchKey = (productId: string, batchId: string): string => `${productId}|${batchId}`;

export function indexSums(sums: readonly StockSum[]): SumIndex {
  const index: SumIndex = { byProduct: new Map(), byBatch: new Map() };
  for (const sum of sums) {
    index.byProduct.set(sum.productId, (index.byProduct.get(sum.productId) ?? 0) + sum.quantity);
    const key = batchKey(sum.productId, sum.batchId);
    index.byBatch.set(key, (index.byBatch.get(key) ?? 0) + sum.quantity);
  }
  return index;
}

/** Earliest expiry first; batches without an expiry date last (FEFO order, like the app). */
function byExpiry(first: BatchData, second: BatchData): number {
  if (first.expiryDate === second.expiryDate) return 0;
  if (first.expiryDate === '') return 1;
  if (second.expiryDate === '') return -1;
  return first.expiryDate < second.expiryDate ? -1 : 1;
}

/** Stored product (base quantities) to the API shape: current stock = base + ledger (FR-API-3). */
export function toProductDto(data: JsonObject, sums: SumIndex): ProductData {
  const product = data as ProductData;
  const batches = product.batches
    .map(batch => ({
      ...batch,
      quantity: batch.quantity + (sums.byBatch.get(batchKey(product.id, batch.id)) ?? 0),
    }))
    .sort(byExpiry);
  return {
    ...product,
    stockOnHand: product.stockOnHand + (sums.byProduct.get(product.id) ?? 0),
    batches,
  };
}

const usesBatches = (product: ProductData): boolean =>
  product.trackBatches && product.batches.length > 0;

interface StockChange {
  batchId: string;
  qtyDelta: number;
}

/** Stock changes needed to take the product from its current figures to the incoming figures. */
function changesFor(
  incoming: ProductData,
  existing: ProductData | null,
  sums: SumIndex
): StockChange[] {
  if (!usesBatches(incoming)) {
    const current = existing ? existing.stockOnHand + (sums.byProduct.get(incoming.id) ?? 0) : 0;
    return [{ batchId: PRODUCT_LEVEL_BATCH_ID, qtyDelta: incoming.stockOnHand - current }];
  }
  const current = new Map<string, number>(
    (existing?.batches ?? []).map(batch => [
      batch.id,
      batch.quantity + (sums.byBatch.get(batchKey(incoming.id, batch.id)) ?? 0),
    ])
  );
  const wanted = new Map(incoming.batches.map(batch => [batch.id, batch.quantity]));
  return [...new Set([...current.keys(), ...wanted.keys()])].map(batchId => ({
    batchId,
    qtyDelta: (wanted.get(batchId) ?? 0) - (current.get(batchId) ?? 0),
  }));
}

export interface WriteContext {
  userId?: string | null;
  deviceCode?: string;
  now: () => string;
}

function assertNoNegativeStock(product: ProductData): void {
  const bad = product.stockOnHand < 0 || product.batches.some(batch => batch.quantity < 0);
  if (bad) throw validationError('Stock cannot be below zero.', [{ message: 'Stock cannot be below zero.' }]);
}

/**
 * REST save: the body carries CURRENT stock figures (what the screen shows). The difference to what
 * the server holds is recorded as ADJUSTMENT movements; the stored base is whatever makes
 * base + ledger equal the incoming figures. A new product with no id gets one.
 */
export async function saveProduct(
  tx: Tx,
  body: unknown,
  context: WriteContext
): Promise<WriteResult & { product: ProductData }> {
  const spec = COLLECTION_BY_NAME.get(PRODUCTS)!;
  const parsed = parseRecord(spec, body) as ProductData;
  assertNoNegativeStock(parsed);
  const id = parsed.id === '' ? randomUUID() : parsed.id;
  const incoming: ProductData = { ...parsed, id };
  await tx.lock(`stock:${id}`);
  const existingRecord = await tx.getEntity(PRODUCTS, id);
  const existing = (existingRecord?.data as ProductData | undefined) ?? null;
  const sums = indexSums(await tx.sumMovements(id));
  const changes = changesFor(incoming, existing, sums).filter(change => change.qtyDelta !== 0);
  const movements: NewMovement[] = changes.map(change => ({
    id: randomUUID(),
    productId: id,
    batchId: change.batchId,
    type: 'ADJUSTMENT',
    qtyDelta: change.qtyDelta,
    refId: null,
    userId: context.userId ?? null,
    deviceCode: context.deviceCode ?? SERVER_DEVICE_CODE,
    createdAt: context.now(),
  }));
  const afterSums = indexSums([
    ...(await tx.sumMovements(id)),
    ...movements.map(movement => ({
      productId: id,
      batchId: movement.batchId,
      quantity: movement.qtyDelta,
    })),
  ]);
  const stored: ProductData = {
    ...incoming,
    stockOnHand: incoming.stockOnHand - (afterSums.byProduct.get(id) ?? 0),
    batches: incoming.batches.map(batch => ({
      ...batch,
      quantity: batch.quantity - (afterSums.byBatch.get(batchKey(id, batch.id)) ?? 0),
    })),
  };
  const result = await upsertRecord(tx, spec, stored);
  if (movements.length > 0) await tx.insertMovements(movements);
  const after = indexSums(await tx.sumMovements(id));
  return { ...result, product: toProductDto(result.record.data, after) };
}

/**
 * Sync apply: the pushed product is the device's stored row (base quantities). Master fields are
 * replaced, but sync never overwrites stock with a total: figures of products and batches the
 * server already holds stay as they are; only brand-new products or batches take the device base.
 */
export function mergeSyncedProduct(existing: ProductData | null, incoming: ProductData): ProductData {
  if (existing === null) return incoming;
  const known = new Map(existing.batches.map(batch => [batch.id, batch]));
  return {
    ...incoming,
    stockOnHand: existing.stockOnHand,
    batches: incoming.batches.map(batch => {
      const held = known.get(batch.id);
      return held ? { ...batch, quantity: held.quantity } : batch;
    }),
  };
}

export async function listProductDtos(tx: Tx): Promise<ProductData[]> {
  const [records, sums] = await Promise.all([tx.listEntities(PRODUCTS), tx.sumMovements()]);
  const index = indexSums(sums);
  return records.map(record => toProductDto(record.data, index));
}

export async function getProductDto(tx: Tx, id: string): Promise<ProductData | null> {
  const record = await tx.getEntity(PRODUCTS, id);
  if (!record) return null;
  return toProductDto(record.data, indexSums(await tx.sumMovements(id)));
}

export interface NegativeStockLine {
  productId: string;
  productName: string;
  batchId: string;
  quantity: number;
}

/** Stock below zero (a sale is never rejected for stock; it is flagged here for review, OQ47). */
export async function negativeStock(tx: Tx): Promise<NegativeStockLine[]> {
  const records = await tx.listEntities(PRODUCTS);
  const index = indexSums(await tx.sumMovements());
  const lines: NegativeStockLine[] = [];
  for (const record of records) {
    const product = toProductDto(record.data, index);
    const name = String(product['name'] ?? '');
    if (usesBatches(product)) {
      for (const batch of product.batches) {
        if (batch.quantity < 0) {
          lines.push({ productId: product.id, productName: name, batchId: batch.id, quantity: batch.quantity });
        }
      }
    } else if (product.stockOnHand < 0) {
      lines.push({
        productId: product.id,
        productName: name,
        batchId: PRODUCT_LEVEL_BATCH_ID,
        quantity: product.stockOnHand,
      });
    }
  }
  return lines;
}

export function productKeyOf(product: JsonObject): string {
  const barcode = String(product['barcode'] ?? '').trim();
  return barcode.length > 0 ? barcode : String(product['sku'] ?? '').trim();
}
