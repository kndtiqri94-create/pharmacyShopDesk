import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound, validationError } from '../errors.js';
import { paginate, parsePaging, parseQuery } from '../lib/http.js';
import {
  PRODUCT_LEVEL_BATCH_ID,
  getProductDto,
  listProductDtos,
  negativeStock,
  saveProduct,
} from '../services/products.js';
import { applyProductSyncBatch } from '../services/product-sync-batch.js';
import { issuesToDetails, parseMovement } from '../services/records.js';
import { Store } from '../store/types.js';

const MAX_MOVEMENTS_PER_REQUEST = 500;

const movementsRequest = z.object({
  movements: z.array(z.unknown()).min(1).max(MAX_MOVEMENTS_PER_REQUEST),
});

const movementQuery = z.object({
  productId: z.string().max(64).optional(),
  refId: z.string().max(64).optional(),
  sinceSeq: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

const idParam = z.object({ id: z.string().trim().min(1).max(64) });

export function registerStockRoutes(app: FastifyInstance, store: Store, now: () => string): void {
  // ------------------------------------------------------------------ products (stock-aware)
  app.get('/products', async request => {
    const paging = parsePaging(request.query);
    return paginate(await store.transaction(tx => listProductDtos(tx)), paging);
  });

  app.get('/products/:id', async request => {
    const { id } = parseQuery(idParam, request.params);
    const product = await store.transaction(tx => getProductDto(tx, id));
    if (!product) throw notFound('The product');
    return product;
  });

  app.post('/products', async (request, reply) => {
    const result = await store.transaction(tx => saveProduct(tx, request.body, { now }));
    return reply.code(result.outcome === 'created' ? 201 : 200).send(result.product);
  });

  app.put('/products/:id', async (request, reply) => {
    const { id } = parseQuery(idParam, request.params);
    const body = { ...((request.body ?? {}) as Record<string, unknown>) };
    if (body['id'] === undefined || body['id'] === '') body['id'] = id;
    if (body['id'] !== id) throw validationError('The id in the path must match the id in the body.');
    const result = await store.transaction(tx => saveProduct(tx, body, { now }));
    return reply.code(result.outcome === 'created' ? 201 : 200).send(result.product);
  });

  // Update Products sync batch (S-2.10.9 contract, OQ48).
  app.post('/products/sync-batch', async request =>
    store.transaction(tx => applyProductSyncBatch(tx, request.body, now))
  );

  // ------------------------------------------------------------------ stock ledger
  /** Record device-generated movements. A movement id already seen is reported as duplicate, never applied twice. */
  app.post('/stock-movements', async request => {
    const envelope = movementsRequest.safeParse(request.body);
    if (!envelope.success) {
      throw validationError('The stock movements are not valid.', issuesToDetails(envelope.error));
    }
    const parsed = envelope.data.movements.map(raw => parseMovement(raw));
    return store.transaction(async tx => {
      const { inserted, duplicateIds } = await tx.insertMovements(parsed);
      const duplicates = new Set(duplicateIds);
      return {
        recorded: inserted.length,
        duplicates: duplicateIds.length,
        results: parsed.map(movement => ({
          id: movement.id,
          status: duplicates.has(movement.id) ? 'duplicate' : 'accepted',
        })),
      };
    });
  });

  app.get('/stock-movements', async request => {
    const query = parseQuery(movementQuery, request.query);
    const rows = await store.transaction(tx =>
      tx.listMovements({ productId: query.productId, refId: query.refId })
    );
    const page = rows.filter(row => row.seq > query.sinceSeq).slice(0, query.limit);
    return { items: page, nextCursor: page.length ? page[page.length - 1]!.seq : query.sinceSeq };
  });

  app.get('/stock/products/:id', async request => {
    const { id } = parseQuery(idParam, request.params);
    return store.transaction(async tx => {
      const product = await getProductDto(tx, id);
      if (!product) throw notFound('The product');
      return {
        productId: id,
        stockOnHand: product.stockOnHand,
        batches: product.trackBatches && product.batches.length > 0
          ? product.batches.map(batch => ({ batchId: batch.id, quantity: batch.quantity }))
          : [{ batchId: PRODUCT_LEVEL_BATCH_ID, quantity: product.stockOnHand }],
      };
    });
  });

  /** Stock below zero, flagged for review (a sale is never rejected for stock reasons). */
  app.get('/stock/negative', async () => ({
    items: await store.transaction(tx => negativeStock(tx)),
  }));
}
