import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Supplier } from '../../../models/domain/supplier.model';
import { SupplierDataService } from '../supplier-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { SUPPLIER_SEED } from './seed/supplier.seed';

@Injectable()
export class InMemorySupplierDataService extends SupplierDataService {
  private readonly collection = new InMemoryCollection<Supplier>(SUPPLIER_SEED);

  getAll(): Observable<readonly Supplier[]> {
    return of(this.collection.all());
  }

  getById(id: string): Observable<Supplier | null> {
    return of(this.collection.byId(id));
  }

  save(item: Supplier): Observable<Supplier> {
    return of(this.collection.upsert(item));
  }
}
