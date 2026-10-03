import { Observable } from 'rxjs';
import { ReloadFloat } from '../../models/domain/reload-float.model';
import { ReloadTransaction } from '../../models/domain/reload-transaction.model';

export abstract class ReloadDataService {
  abstract getTransactions(): Observable<readonly ReloadTransaction[]>;
  abstract getFloatHistory(): Observable<readonly ReloadFloat[]>;
  abstract addTransaction(transaction: ReloadTransaction): Observable<ReloadTransaction>;
}
