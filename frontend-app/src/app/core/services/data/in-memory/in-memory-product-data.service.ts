import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Product } from '../../../models/domain/product.model';
import { sortBatchesByExpiry } from '../../../utils/batch-order.util';
import { ProductDataService } from '../product-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { PRODUCT_SEED } from './seed/product.seed';

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
    return of(this.withOrderedBatches(this.collection.upsert(product)));
  }

  private withOrderedBatches(product: Product): Product {
    return { ...product, batches: sortBatchesByExpiry(product.batches) };
  }
}
