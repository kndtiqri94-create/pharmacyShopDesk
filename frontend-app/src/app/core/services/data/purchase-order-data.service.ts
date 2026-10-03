import { Observable } from 'rxjs';
import { PurchaseOrder } from '../../models/domain/purchase-order.model';

export abstract class PurchaseOrderDataService {
  abstract getAll(): Observable<readonly PurchaseOrder[]>;
  abstract getById(id: string): Observable<PurchaseOrder | null>;
  abstract save(order: PurchaseOrder): Observable<PurchaseOrder>;
}
