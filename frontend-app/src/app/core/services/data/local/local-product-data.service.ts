import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Product } from '../../../models/domain/product.model';
import { StockChangeContext } from '../../../models/domain/stock-movement.model';
import { StockMovementType } from '../../../models/enums/stock-movement-type.enum';
import { sortBatchesByExpiry } from '../../../utils/batch-order.util';
import { nextRecordId } from '../../../utils/document-number.util';
import { PRODUCT_LEVEL_BATCH_ID, StockSums, batchKey } from '../../../utils/stock-ledger.util';
import { DuplicateSkuError } from '../duplicate-sku.error';
import { ProductDataService } from '../product-data.service';
import { LocalDatabase, ProductRow } from './local-database';
import { LocalDatabaseProvider } from './local-database.provider';
import { skuKeyOf } from './local-product-keys';
import { LocalStockLedgerService, StockChange } from './local-stock-ledger.service';

const ID_PREFIX = 'prod';
const DEFAULT_CONTEXT: StockChangeContext = { type: StockMovementType.ADJUSTMENT };

function usesBatches(product: Product): boolean {
  return product.trackBatches && product.batches.length > 0;
}

function toProduct(row: ProductRow, sums: StockSums): Product {
  const copy: Record<string, unknown> = { ...row };
  delete copy['_ord'];
  delete copy['skuKey'];
  const product = copy as unknown as Product;
  const batches = product.batches.map(batch => ({
    ...batch,
    quantity: batch.quantity + (sums.byBatch.get(batchKey(row.id, batch.id)) ?? 0),
  }));
  return {
    ...product,
    stockOnHand: product.stockOnHand + (sums.byProduct.get(row.id) ?? 0),
    batches: sortBatchesByExpiry(batches),
  };
}

@Injectable()
export class LocalProductDataService extends ProductDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);
  private readonly ledger = inject(LocalStockLedgerService);

  getAll(): Observable<readonly Product[]> {
    return this.databaseProvider.observe(async db => {
      const rows = await db.products.orderBy('_ord').toArray();
      const sums = await this.ledger.sums(db);
      return rows.map(row => toProduct(row, sums));
    });
  }

  getById(id: string): Observable<Product | null> {
    return this.databaseProvider.observe(async db => {
      const row = await db.products.get(id);
      if (row === undefined) return null;
      return toProduct(row, await this.ledger.sumsForProduct(db, id));
    });
  }

  save(product: Product, context: StockChangeContext = DEFAULT_CONTEXT): Observable<Product> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.products, db.stockMovements, db.meta, async () => {
        await this.assertSkuIsFree(db, product);
        const id = product.id === '' ? await this.nextId(db) : product.id;
        return this.write(db, { ...product, id }, context);
      })
    );
  }

  saveAll(
    products: readonly Product[],
    context: StockChangeContext = DEFAULT_CONTEXT
  ): Observable<readonly Product[]> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.products, db.stockMovements, db.meta, async () => {
        const known = new Set(await db.products.toCollection().primaryKeys());
        if (products.some(product => !known.has(product.id))) {
          throw new Error('Cannot save a product that does not exist.');
        }
        const saved: Product[] = [];
        for (const product of products) saved.push(await this.write(db, product, context));
        return saved;
      })
    );
  }

  private async assertSkuIsFree(db: LocalDatabase, product: Product): Promise<void> {
    const key = skuKeyOf(product.sku);
    if (key.length === 0) return;
    const clashes = await db.products.where('skuKey').equals(key).primaryKeys();
    if (clashes.some(existingId => existingId !== product.id)) {
      throw new DuplicateSkuError(product.sku);
    }
  }

  private async nextId(db: LocalDatabase): Promise<string> {
    return nextRecordId(ID_PREFIX, await db.products.toCollection().primaryKeys());
  }

  private async write(
    db: LocalDatabase,
    product: Product,
    context: StockChangeContext
  ): Promise<Product> {
    const existing = await db.products.get(product.id);
    const before = await this.ledger.sumsForProduct(db, product.id);
    const changes = this.changesFor(product, existing, before);
    await this.ledger.append(db, changes, context);
    const after = await this.ledger.sumsForProduct(db, product.id);
    const order = existing?._ord ?? (await this.nextOrder(db));
    const row: ProductRow = {
      ...product,
      _ord: order,
      skuKey: skuKeyOf(product.sku),
      stockOnHand: product.stockOnHand - (after.byProduct.get(product.id) ?? 0),
      batches: product.batches.map(batch => ({
        ...batch,
        quantity: batch.quantity - (after.byBatch.get(batchKey(product.id, batch.id)) ?? 0),
      })),
    };
    await db.products.put(row);
    db.afterWrite('products', row.id, 'put');
    return toProduct(row, after);
  }

  private changesFor(
    product: Product,
    existing: ProductRow | undefined,
    sums: StockSums
  ): StockChange[] {
    const productId = product.id;
    if (!usesBatches(product)) {
      const current =
        existing === undefined ? 0 : existing.stockOnHand + (sums.byProduct.get(productId) ?? 0);
      return [
        { productId, batchId: PRODUCT_LEVEL_BATCH_ID, qtyDelta: product.stockOnHand - current },
      ];
    }
    const current = new Map<string, number>(
      (existing?.batches ?? []).map(batch => [
        batch.id,
        batch.quantity + (sums.byBatch.get(batchKey(productId, batch.id)) ?? 0),
      ])
    );
    const incoming = new Map(product.batches.map(batch => [batch.id, batch.quantity]));
    const batchIds = new Set([...current.keys(), ...incoming.keys()]);
    return [...batchIds].map(batchId => ({
      productId,
      batchId,
      qtyDelta: (incoming.get(batchId) ?? 0) - (current.get(batchId) ?? 0),
    }));
  }

  private async nextOrder(db: LocalDatabase): Promise<number> {
    const last = await db.products.orderBy('_ord').last();
    return (last?._ord ?? 0) + 1;
  }
}
