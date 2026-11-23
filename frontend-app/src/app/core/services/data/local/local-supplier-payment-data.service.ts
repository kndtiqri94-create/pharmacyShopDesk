import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SupplierPayment } from '../../../models/domain/supplier-payment.model';
import { SupplierPaymentDataService } from '../supplier-payment-data.service';
import { LocalCollection } from './local-collection';
import { LocalDatabaseProvider } from './local-database.provider';

@Injectable()
export class LocalSupplierPaymentDataService extends SupplierPaymentDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  getAll(): Observable<readonly SupplierPayment[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<SupplierPayment>(db.supplierPayments).all()
    );
  }

  save(item: SupplierPayment): Observable<SupplierPayment> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.supplierPayments, () =>
        new LocalCollection<SupplierPayment>(db.supplierPayments).upsert(item)
      )
    );
  }
}
