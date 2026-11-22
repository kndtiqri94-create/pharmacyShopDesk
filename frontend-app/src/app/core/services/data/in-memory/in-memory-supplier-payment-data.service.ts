import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { SupplierPayment } from '../../../models/domain/supplier-payment.model';
import { SupplierPaymentDataService } from '../supplier-payment-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { SUPPLIER_PAYMENT_SEED } from './seed/supplier-payment.seed';

@Injectable()
export class InMemorySupplierPaymentDataService extends SupplierPaymentDataService {
  private readonly collection = new InMemoryCollection<SupplierPayment>(SUPPLIER_PAYMENT_SEED);

  getAll(): Observable<readonly SupplierPayment[]> {
    return of(this.collection.all());
  }

  save(item: SupplierPayment): Observable<SupplierPayment> {
    return of(this.collection.upsert(item));
  }
}
