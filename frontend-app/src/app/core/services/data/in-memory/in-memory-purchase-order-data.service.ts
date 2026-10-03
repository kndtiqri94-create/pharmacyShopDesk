import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { PurchaseOrder } from '../../../models/domain/purchase-order.model';
import { PurchaseOrderDataService } from '../purchase-order-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { PURCHASE_ORDER_SEED } from './seed/purchase-order.seed';

@Injectable()
export class InMemoryPurchaseOrderDataService extends PurchaseOrderDataService {
  private readonly collection = new InMemoryCollection<PurchaseOrder>(PURCHASE_ORDER_SEED);

  getAll(): Observable<readonly PurchaseOrder[]> {
    return of(this.collection.all());
  }

  getById(id: string): Observable<PurchaseOrder | null> {
    return of(this.collection.byId(id));
  }

  save(item: PurchaseOrder): Observable<PurchaseOrder> {
    return of(this.collection.upsert(item));
  }
}
