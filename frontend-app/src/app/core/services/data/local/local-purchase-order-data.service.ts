import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PurchaseOrder } from '../../../models/domain/purchase-order.model';
import { PurchaseOrderDataService } from '../purchase-order-data.service';
import { LocalCollection } from './local-collection';
import { LocalDatabaseProvider } from './local-database.provider';

@Injectable()
export class LocalPurchaseOrderDataService extends PurchaseOrderDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  getAll(): Observable<readonly PurchaseOrder[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<PurchaseOrder>(db.purchaseOrders).all()
    );
  }

  getById(id: string): Observable<PurchaseOrder | null> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<PurchaseOrder>(db.purchaseOrders).byId(id)
    );
  }

  save(item: PurchaseOrder): Observable<PurchaseOrder> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.purchaseOrders, () =>
        new LocalCollection<PurchaseOrder>(db.purchaseOrders).upsert(item)
      )
    );
  }
}
