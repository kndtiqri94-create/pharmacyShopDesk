import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Grn } from '../../../models/domain/grn.model';
import { GrnDataService } from '../grn-data.service';
import { LocalCollection } from './local-collection';
import { LocalDatabaseProvider } from './local-database.provider';

@Injectable()
export class LocalGrnDataService extends GrnDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  getAll(): Observable<readonly Grn[]> {
    return this.databaseProvider.observe(db => new LocalCollection<Grn>(db.grns).all());
  }

  getById(id: string): Observable<Grn | null> {
    return this.databaseProvider.observe(db => new LocalCollection<Grn>(db.grns).byId(id));
  }

  save(item: Grn): Observable<Grn> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.grns, () => new LocalCollection<Grn>(db.grns).upsert(item))
    );
  }
}
