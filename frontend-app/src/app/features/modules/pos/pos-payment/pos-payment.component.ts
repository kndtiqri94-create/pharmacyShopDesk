import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { BankAccountService } from '../../../../core/services/bank-account.service';
import { PosService } from '../../../../core/services/pos.service';
import {
  CARD_LAST4_LENGTH,
  ONLINE_NOTE_MAX_LENGTH,
  onlyDigits,
} from '../../../../core/utils/bank-account-validation.util';
import { formatRupeesExact, formatRupeesInput } from '../../../../core/utils/money.util';
import { POS_SHORTCUT_KEYS } from '../../../../core/utils/pos-shortcut.util';
import { BalanceKind } from '../../../../core/utils/pos-totals.util';
import {
  AMOUNT_TEXT_MAX_LENGTH,
  CREDIT_WALK_IN_MESSAGE,
  PaymentFieldKey,
  PaymentMethodKey,
} from '../../../../core/utils/pos-validation.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CreateAccountDialogComponent } from '../create-account-dialog/create-account-dialog.component';

const BALANCE_LABELS: Record<BalanceKind, string> = {
  CHANGE: 'Change',
  CREDIT_DUE: 'Credit due',
  DUE: 'Amount due',
  SETTLED: 'Balance',
};

interface MethodTile {
  id: PaymentMethodKey;
  label: string;
  shortcut: string | null;
}

@Component({
  selector: 'app-pos-payment',
  imports: [ButtonComponent, CreateAccountDialogComponent, IconComponent, ...FIELD_IMPORTS],
  templateUrl: './pos-payment.component.html',
  styleUrl: './pos-payment.component.scss',
})
export class PosPaymentComponent {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly bankAccountService = inject(BankAccountService);

  protected readonly posService = inject(PosService);
  protected readonly amountMaxLength = AMOUNT_TEXT_MAX_LENGTH;
  protected readonly last4Length = CARD_LAST4_LENGTH;
  protected readonly noteMaxLength = ONLINE_NOTE_MAX_LENGTH;
  protected readonly walkInMessage = CREDIT_WALK_IN_MESSAGE;
  protected readonly money = formatRupeesExact;
  protected readonly createOpen = signal(false);
  protected readonly accountOptions = this.bankAccountService.options;
  protected readonly tiles: readonly MethodTile[] = [
    { id: 'cash', label: 'Cash', shortcut: POS_SHORTCUT_KEYS.PAY_CASH },
    { id: 'card', label: 'Card', shortcut: POS_SHORTCUT_KEYS.PAY_CARD },
    { id: 'online', label: 'Online', shortcut: POS_SHORTCUT_KEYS.PAY_ONLINE },
    { id: 'credit', label: 'Credit', shortcut: null },
  ];
  protected readonly creditText = computed(() => {
    const { totalCents, paidCents } = this.posService.totals();
    return formatRupeesInput(Math.max(0, totalCents - paidCents));
  });
  protected readonly balanceLabel = computed(
    () => BALANCE_LABELS[this.posService.totals().balanceKind]
  );
  protected readonly last4Error = computed(() =>
    this.posService.showPaymentProblems() ? this.posService.paymentProblems().cardLast4 : null
  );
  protected readonly accountError = computed(() =>
    this.posService.showPaymentProblems() ? this.posService.paymentProblems().onlineAccount : null
  );

  selectMethod(method: PaymentMethodKey): void {
    this.posService.selectPaymentMethod(method);
    if (method !== 'credit')
      afterNextRender(() => this.focusField(`pos-pay-${method}`), { injector: this.injector });
  }

  protected tileName(tile: MethodTile): string {
    return tile.shortcut ? `${tile.label} ${tile.shortcut}` : tile.label;
  }

  protected onAmountInput(field: PaymentFieldKey, event: Event): void {
    this.posService.setPaymentText(field, (event.target as HTMLInputElement).value);
  }

  protected onLast4Input(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = onlyDigits(input.value, CARD_LAST4_LENGTH);
    input.value = digits;
    this.posService.setCardLast4(digits);
  }

  protected onNoteInput(event: Event): void {
    this.posService.setOnlineNote((event.target as HTMLTextAreaElement).value);
  }

  protected onAccountChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.posService.setOnlineAccount(value === '' ? null : value);
  }

  protected clearAmount(field: PaymentFieldKey): void {
    this.posService.clearPaymentText(field);
    this.focusField(`pos-pay-${field}`);
  }

  protected clearLast4(): void {
    this.posService.setCardLast4('');
    this.focusField('pos-card-last4');
  }

  protected openCreateAccount(): void {
    this.createOpen.set(true);
  }

  protected closeCreateAccount(): void {
    this.createOpen.set(false);
    setTimeout(() =>
      this.hostElement.nativeElement.querySelector<HTMLElement>('.account__add button')?.focus()
    );
  }

  protected onAccountCreated(accountId: string): void {
    this.posService.setOnlineAccount(accountId);
  }

  private focusField(id: string): void {
    this.hostElement.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus();
  }
}
