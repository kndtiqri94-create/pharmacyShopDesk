import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { BankAccount } from '../../../models/domain/bank-account.model';
import { isDuplicateAccount } from '../../../utils/bank-account-validation.util';
import { BankAccountDataService } from '../bank-account-data.service';
import { DuplicateBankAccountError } from '../duplicate-bank-account.error';
import { InMemoryCollection } from './in-memory-collection';
import { BANK_ACCOUNT_SEED } from './seed/bank-account.seed';

@Injectable()
export class InMemoryBankAccountDataService extends BankAccountDataService {
  private readonly collection = new InMemoryCollection<BankAccount>(BANK_ACCOUNT_SEED);

  getAll(): Observable<readonly BankAccount[]> {
    return of(this.collection.all());
  }

  create(account: BankAccount): Observable<BankAccount> {
    const others = this.collection.all().filter(existing => existing.id !== account.id);
    if (isDuplicateAccount(others, account.bank, account.accountNo)) {
      return throwError(() => new DuplicateBankAccountError());
    }
    return of(this.collection.upsert(account));
  }
}
