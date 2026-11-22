import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { BankAccount } from '../../../models/domain/bank-account.model';
import { BankAccountDataService } from '../bank-account-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { BANK_ACCOUNT_SEED } from './seed/bank-account.seed';

@Injectable()
export class InMemoryBankAccountDataService extends BankAccountDataService {
  private readonly collection = new InMemoryCollection<BankAccount>(BANK_ACCOUNT_SEED);

  getAll(): Observable<readonly BankAccount[]> {
    return of(this.collection.all());
  }

  create(account: BankAccount): Observable<BankAccount> {
    return of(this.collection.upsert(account));
  }
}
