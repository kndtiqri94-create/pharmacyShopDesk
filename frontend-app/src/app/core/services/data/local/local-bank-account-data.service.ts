import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BankAccount } from '../../../models/domain/bank-account.model';
import { isDuplicateAccount } from '../../../utils/bank-account-validation.util';
import { BankAccountDataService } from '../bank-account-data.service';
import { DuplicateBankAccountError } from '../duplicate-bank-account.error';
import { LocalCollection } from './local-collection';
import { LocalDatabaseProvider } from './local-database.provider';

@Injectable()
export class LocalBankAccountDataService extends BankAccountDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  getAll(): Observable<readonly BankAccount[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<BankAccount>(db.bankAccounts).all()
    );
  }

  create(account: BankAccount): Observable<BankAccount> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.bankAccounts, async () => {
        const collection = new LocalCollection<BankAccount>(db.bankAccounts);
        const others = (await collection.all()).filter(existing => existing.id !== account.id);
        if (isDuplicateAccount(others, account.bank, account.accountNo)) {
          throw new DuplicateBankAccountError();
        }
        return collection.upsert(account);
      })
    );
  }
}
