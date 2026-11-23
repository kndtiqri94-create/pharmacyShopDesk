import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ReloadFloat } from '../../../models/domain/reload-float.model';
import { ReloadTransaction } from '../../../models/domain/reload-transaction.model';
import { ReloadDataService } from '../reload-data.service';
import { LocalCollection } from './local-collection';
import { LocalDatabaseProvider } from './local-database.provider';

@Injectable()
export class LocalReloadDataService extends ReloadDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  getTransactions(): Observable<readonly ReloadTransaction[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<ReloadTransaction>(db.reloadTransactions).all()
    );
  }

  getFloatHistory(): Observable<readonly ReloadFloat[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<ReloadFloat>(db.reloadFloats, 'date').all()
    );
  }

  saveFloat(reloadFloat: ReloadFloat): Observable<ReloadFloat> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.reloadFloats, () =>
        new LocalCollection<ReloadFloat>(db.reloadFloats, 'date').upsert(reloadFloat)
      )
    );
  }

  addTransaction(transaction: ReloadTransaction): Observable<ReloadTransaction> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.reloadTransactions, () =>
        new LocalCollection<ReloadTransaction>(db.reloadTransactions).upsert(transaction)
      )
    );
  }
}
