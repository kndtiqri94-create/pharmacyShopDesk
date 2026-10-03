import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { Product } from '../../../models/domain/product.model';
import { sortBatchesByExpiry } from '../../../utils/batch-order.util';
import { DuplicateSkuError } from '../duplicate-sku.error';
import { ProductDataService } from '../product-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { PRODUCT_SEED } from './seed/product.seed';

const ID_PREFIX = 'prod-';

@Injectable()
export class InMemoryProductDataService extends ProductDataService {
  private readonly collection = new InMemoryCollection<Product>(PRODUCT_SEED);

  getAll(): Observable<readonly Product[]> {
    return of(this.collection.all().map(product => this.withOrderedBatches(product)));
  }

  getById(id: string): Observable<Product | null> {
    const product = this.collection.byId(id);
    return of(product ? this.withOrderedBatches(product) : null);
  }

  save(product: Product): Observable<Product> {
    const sku = product.sku.trim().toLowerCase();
    const clash =
      sku.length > 0 &&
      this.collection
        .all()
        .some(existing => existing.id !== product.id && existing.sku.trim().toLowerCase() === sku);
    if (clash) return throwError(() => new DuplicateSkuError(product.sku));
    const id = product.id === '' ? this.nextId() : product.id;
    return of(this.withOrderedBatches(this.collection.upsert({ ...product, id })));
  }

  private nextId(): string {
    const highest = this.collection
      .all()
      .map(product => Number(product.id.slice(ID_PREFIX.length)))
      .filter(Number.isInteger)
      .reduce((max, value) => Math.max(max, value), 0);
    return `${ID_PREFIX}${String(highest + 1).padStart(3, '0')}`;
  }

  private withOrderedBatches(product: Product): Product {
    return { ...product, batches: sortBatchesByExpiry(product.batches) };
  }
}
