import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Supplier } from '../../../models/domain/supplier.model';
import { SupplierDataService } from '../supplier-data.service';
import { LocalCollection } from './local-collection';
import { LocalDatabaseProvider } from './local-database.provider';

@Injectable()
export class LocalSupplierDataService extends SupplierDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  getAll(): Observable<readonly Supplier[]> {
    return this.databaseProvider.observe(db => new LocalCollection<Supplier>(db.suppliers).all());
  }

  getById(id: string): Observable<Supplier | null> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<Supplier>(db.suppliers).byId(id)
    );
  }

  save(item: Supplier): Observable<Supplier> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.suppliers, () =>
        new LocalCollection<Supplier>(db.suppliers).upsert(item)
      )
    );
  }
}
