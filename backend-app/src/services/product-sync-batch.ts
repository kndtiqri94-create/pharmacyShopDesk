import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { COLLECTION_BY_NAME } from '../domain/collections.js';
import { AppError, validationError } from '../errors.js';
import { EntityRecord, NewMovement, Tx } from '../store/types.js';
import {
  PRODUCT_LEVEL_BATCH_ID,
  ProductData,
  SERVER_DEVICE_CODE,
  indexSums,
  productKeyOf,
  toProductDto,
} from './products.js';
import { issuesToDetails, upsertRecord } from './records.js';

/**
 * Update Products sync batch (S-2.10.9 contract, reconciled with the new API per OQ48).
 * The request and response bodies are exactly those of docs/api-docs/2.10.9_UPDATE_PRODUCTS_SYNC_API_API_DOC.md,
 * so the app's `ProductSyncServer` boundary can be bound to one POST per batch with no change to the
 * app service. Stock changes arrive as stockDelta, are recorded as ledger movements once per
 * operationId and the server's resulting stock is returned.
 */

const MAX_BATCH = 500;
const MAX_SERVER_ONLY = 5000;
const OPS_COLLECTION = '_productSyncOps';
const MAX_CENTS = 100_000_000_000;
const MAX_STOCK = 10_000_000;

const record = z.object({
  matchKey: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  category: z.string().max(100),
  unit: z.string().max(100),
  priceCents: z.number().int().min(0).max(MAX_CENTS),
  costCents: z.number().int().min(0).max(MAX_CENTS),
  stockOnHand: z.number().int().min(0).max(MAX_STOCK),
  active: z.boolean(),
  stockDelta: z.number().int().min(-MAX_STOCK).max(MAX_STOCK),
  operationId: z.string().min(1).max(100),
});

export const productSyncBatchRequest = z.object({
  batchNumber: z.number().int().min(1),
  totalBatches: z.number().int().min(1),
  records: z.array(record).max(MAX_BATCH),
  appMatchKeys: z.array(z.string().max(64)).max(50_000).nullable(),
});

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

export interface ProductSyncBatchResponse {
  batchNumber: number;
  records: ProductSyncServerRecord[];
  serverOnlyRecords: ProductSyncServerRecord[];
}

const batchFailed = (message: string): AppError => new AppError(422, 'batch_failed', message);

function toServerRecord(product: ProductData): ProductSyncServerRecord {
  return {
    matchKey: productKeyOf(product),
    name: String(product['name']),
    category: String(product['category'] ?? ''),
    unit: String(product['unit'] ?? ''),
    priceCents: Number(product['priceCents']),
    costCents: Number(product['costCents']),
    stockOnHand: product.stockOnHand,
    active: Boolean(product['active']),
  };
}

export async function applyProductSyncBatch(
  tx: Tx,
  body: unknown,
  now: () => string
): Promise<ProductSyncBatchResponse> {
  const parsed = productSyncBatchRequest.safeParse(body);
  if (!parsed.success) {
    throw validationError('The product sync batch is not valid.', issuesToDetails(parsed.error));
  }
  const request = parsed.data;
  if (request.batchNumber > request.totalBatches) {
    throw validationError('The batch number cannot be above the total number of batches.');
  }
  const products = await tx.listEntities('products');
  const byKey = new Map(products.map(item => [productKeyOf(item.data), item]));
  const responses: ProductSyncServerRecord[] = [];

  for (const incoming of request.records) {
    const op = await tx.getEntity(OPS_COLLECTION, incoming.operationId);
    const existing = byKey.get(incoming.matchKey);
    if (!existing) {
      const created = await createFromRecord(tx, incoming);
      byKey.set(incoming.matchKey, created);
      responses.push(toServerRecord(toProductDto(created.data, indexSums(await tx.sumMovements(created.id)))));
      continue;
    }
    const productId = existing.id;
    await tx.lock(`stock:${productId}`);
    if (op) {
      if (Number(op.data['delta']) !== incoming.stockDelta) {
        throw batchFailed('An operation id was repeated with a different stock change.');
      }
    } else {
      await applyDelta(tx, productId, incoming, indexSums(await tx.sumMovements(productId)), now);
      await tx.putEntity({
        collection: OPS_COLLECTION,
        id: incoming.operationId,
        data: { delta: incoming.stockDelta, productId },
        uniqueKey: null,
        dateKey: null,
      });
    }
    const fresh = await tx.getEntity('products', productId);
    const dto = toProductDto(fresh!.data, indexSums(await tx.sumMovements(productId)));
    responses.push(toServerRecord(dto));
  }

  let serverOnly: ProductSyncServerRecord[] = [];
  if (request.batchNumber === request.totalBatches && request.appMatchKeys !== null) {
    const appKeys = new Set(request.appMatchKeys);
    const all = indexSums(await tx.sumMovements());
    serverOnly = (await tx.listEntities('products'))
      .filter(item => !appKeys.has(productKeyOf(item.data)))
      .slice(0, MAX_SERVER_ONLY)
      .map(item => toServerRecord(toProductDto(item.data, all)));
  }
  return { batchNumber: request.batchNumber, records: responses, serverOnlyRecords: serverOnly };
}

async function applyDelta(
  tx: Tx,
  productId: string,
  incoming: z.infer<typeof record>,
  sums: ReturnType<typeof indexSums>,
  now: () => string
): Promise<void> {
  if (incoming.stockDelta === 0) return;
  const current = (await tx.getEntity('products', productId))!.data as ProductData;
  const effective = current.stockOnHand + (sums.byProduct.get(productId) ?? 0);
  // Stock never goes below zero through this sync (floor at 0, as the app contract states).
  const delta = Math.max(incoming.stockDelta, -effective);
  if (delta === 0) return;
  const movement: NewMovement = {
    id: `opsync:${incoming.operationId}`,
    productId,
    batchId: PRODUCT_LEVEL_BATCH_ID,
    type: 'ADJUSTMENT',
    qtyDelta: delta,
    refId: incoming.operationId,
    userId: null,
    deviceCode: SERVER_DEVICE_CODE,
    createdAt: now(),
  };
  await tx.insertMovements([movement]);
}

async function createFromRecord(
  tx: Tx,
  incoming: z.infer<typeof record>
): Promise<EntityRecord> {
  const spec = COLLECTION_BY_NAME.get('products')!;
  const data = spec.schema.parse({
    id: randomUUID(),
    name: incoming.name,
    category: incoming.category,
    unit: incoming.unit || 'piece',
    sku: incoming.matchKey,
    barcode: incoming.matchKey,
    costCents: incoming.costCents,
    priceCents: incoming.priceCents,
    reorderLevel: 0,
    trackBatches: false,
    stockOnHand: incoming.stockOnHand,
    prescriptionRequired: false,
    active: incoming.active,
    taxRatePercent: 0,
    showInPosQuickList: false,
    batches: [],
  }) as Record<string, unknown>;
  const result = await upsertRecord(tx, spec, data);
  await tx.putEntity({
    collection: OPS_COLLECTION,
    id: incoming.operationId,
    data: { delta: incoming.stockDelta, productId: result.record.id },
    uniqueKey: null,
    dateKey: null,
  });
  return result.record;
}
