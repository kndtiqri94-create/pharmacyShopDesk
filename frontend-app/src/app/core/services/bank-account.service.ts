import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BankAccount } from '../models/domain/bank-account.model';
import {
  BankAccountErrors,
  BankAccountInput,
  DUPLICATE_ACCOUNT_MESSAGE,
  bankAccountLabel,
  isDuplicateAccount,
  sortAccountsByBank,
  validateBankAccount,
} from '../utils/bank-account-validation.util';
import { nextRecordId } from '../utils/document-number.util';
import { BankAccountDataService } from './data/bank-account-data.service';

export type CreateBankAccountResult =
  { ok: true; account: BankAccount } | { ok: false; errors: BankAccountErrors };

export interface BankAccountOption {
  id: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class BankAccountService {
  private readonly dataService = inject(BankAccountDataService);
  private readonly accountsSignal = signal<readonly BankAccount[]>([]);

  readonly accounts = computed(() => sortAccountsByBank(this.accountsSignal()));
  readonly options = computed<BankAccountOption[]>(() =>
    this.accounts().map(account => ({ id: account.id, label: bankAccountLabel(account) }))
  );

  async load(): Promise<void> {
    this.accountsSignal.set(await firstValueFrom(this.dataService.getAll()));
  }

  findById(id: string | null): BankAccount | null {
    return id === null ? null : (this.accountsSignal().find(item => item.id === id) ?? null);
  }

  async create(input: BankAccountInput): Promise<CreateBankAccountResult> {
    const validation = validateBankAccount(input);
    if (!validation.ok) return validation;
    const existing = await firstValueFrom(this.dataService.getAll());
    if (isDuplicateAccount(existing, validation.values.bank, validation.values.accountNo)) {
      return { ok: false, errors: { accountNo: DUPLICATE_ACCOUNT_MESSAGE } };
    }
    const id = nextRecordId(
      'bank',
      existing.map(item => item.id)
    );
    const saved = await firstValueFrom(this.dataService.create({ id, ...validation.values }));
    this.accountsSignal.set([...existing, saved]);
    return { ok: true, account: saved };
  }
}
