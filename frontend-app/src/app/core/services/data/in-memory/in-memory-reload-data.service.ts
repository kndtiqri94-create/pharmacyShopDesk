import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ReloadFloat } from '../../../models/domain/reload-float.model';
import { ReloadTransaction } from '../../../models/domain/reload-transaction.model';
import { cloneValue } from '../../../utils/clone.util';
import { ReloadDataService } from '../reload-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { RELOAD_FLOAT_SEED, RELOAD_TRANSACTION_SEED } from './seed/reload.seed';

@Injectable()
export class InMemoryReloadDataService extends ReloadDataService {
  private readonly transactions = new InMemoryCollection<ReloadTransaction>(
    RELOAD_TRANSACTION_SEED
  );
  private readonly floatHistory: ReloadFloat[] = cloneValue([...RELOAD_FLOAT_SEED]);

  getTransactions(): Observable<readonly ReloadTransaction[]> {
    return of(this.transactions.all());
  }

  getFloatHistory(): Observable<readonly ReloadFloat[]> {
    return of(cloneValue(this.floatHistory));
  }

  saveFloat(reloadFloat: ReloadFloat): Observable<ReloadFloat> {
    const copy = cloneValue(reloadFloat);
    const index = this.floatHistory.findIndex(entry => entry.date === copy.date);
    if (index === -1) {
      this.floatHistory.push(copy);
    } else {
      this.floatHistory[index] = copy;
    }
    return of(cloneValue(copy));
  }

  addTransaction(transaction: ReloadTransaction): Observable<ReloadTransaction> {
    return of(this.transactions.upsert(transaction));
  }
}
