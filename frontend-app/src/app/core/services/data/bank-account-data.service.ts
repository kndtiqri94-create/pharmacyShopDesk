import { Observable } from 'rxjs';
import { BankAccount } from '../../models/domain/bank-account.model';

export abstract class BankAccountDataService {
  abstract getAll(): Observable<readonly BankAccount[]>;
  abstract create(account: BankAccount): Observable<BankAccount>;
}
