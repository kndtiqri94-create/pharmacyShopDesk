import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Grn } from '../../../models/domain/grn.model';
import { GrnDataService } from '../grn-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { GRN_SEED } from './seed/grn.seed';

@Injectable()
export class InMemoryGrnDataService extends GrnDataService {
  private readonly collection = new InMemoryCollection<Grn>(GRN_SEED);

  getAll(): Observable<readonly Grn[]> {
    return of(this.collection.all());
  }

  getById(id: string): Observable<Grn | null> {
    return of(this.collection.byId(id));
  }

  save(item: Grn): Observable<Grn> {
    return of(this.collection.upsert(item));
  }
}
