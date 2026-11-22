import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { BankAccountService } from '../../../../core/services/bank-account.service';
import {
  ACCOUNT_NO_MAX_LENGTH,
  BANK_TEXT_MAX_LENGTH,
  BankAccountErrors,
  OPENING_BALANCE_MAX_LENGTH,
  onlyDigits,
} from '../../../../core/utils/bank-account-validation.util';
import { SRI_LANKAN_BANKS } from '../../../../core/utils/sri-lankan-banks.const';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PosDialogComponent } from '../pos-dialog/pos-dialog.component';

@Component({
  selector: 'app-create-account-dialog',
  imports: [ButtonComponent, PosDialogComponent, ...FIELD_IMPORTS],
  templateUrl: './create-account-dialog.component.html',
  styleUrl: './create-account-dialog.component.scss',
})
export class CreateAccountDialogComponent {
  readonly open = input(false);
  readonly closed = output<void>();
  readonly created = output<string>();

  private readonly bankAccountService = inject(BankAccountService);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly banks = SRI_LANKAN_BANKS;
  protected readonly textMaxLength = BANK_TEXT_MAX_LENGTH;
  protected readonly accountNoMaxLength = ACCOUNT_NO_MAX_LENGTH;
  protected readonly balanceMaxLength = OPENING_BALANCE_MAX_LENGTH;
  protected readonly bank = signal('');
  protected readonly branch = signal('');
  protected readonly holderName = signal('');
  protected readonly accountNo = signal('');
  protected readonly openingBalance = signal('');
  protected readonly errors = signal<BankAccountErrors>({});
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.reset());
    });
  }

  protected onBank(event: Event): void {
    this.bank.set((event.target as HTMLSelectElement).value);
    this.clearError('bank');
  }

  protected onBranch(event: Event): void {
    this.branch.set((event.target as HTMLInputElement).value);
    this.clearError('branch');
  }

  protected onHolderName(event: Event): void {
    this.holderName.set((event.target as HTMLInputElement).value);
    this.clearError('holderName');
  }

  protected onAccountNo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = onlyDigits(input.value, ACCOUNT_NO_MAX_LENGTH);
    input.value = digits;
    this.accountNo.set(digits);
    this.clearError('accountNo');
  }

  protected onOpeningBalance(event: Event): void {
    this.openingBalance.set((event.target as HTMLInputElement).value);
    this.clearError('openingBalance');
  }

  protected save(): void {
    this.submit().catch(() => undefined);
  }

  private async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const result = await this.bankAccountService.create({
        bank: this.bank(),
        branch: this.branch(),
        holderName: this.holderName(),
        accountNo: this.accountNo(),
        openingBalance: this.openingBalance(),
      });
      if (!result.ok) {
        this.errors.set(result.errors);
        return;
      }
      this.created.emit(result.account.id);
      this.closed.emit();
    } finally {
      this.busy.set(false);
    }
  }

  private clearError(field: keyof BankAccountErrors): void {
    if (this.errors()[field] === undefined) return;
    this.errors.update(current => ({ ...current, [field]: undefined }));
  }

  private reset(): void {
    this.bank.set('');
    this.branch.set('');
    this.holderName.set('');
    this.accountNo.set('');
    this.openingBalance.set('');
    this.errors.set({});
    setTimeout(() =>
      this.hostElement.nativeElement.querySelector<HTMLElement>('#create-account-bank')?.focus()
    );
  }
}
