import { Component, ElementRef, inject, input, output, signal } from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { ReloadService } from '../../../../core/services/reload.service';
import { formatRupeesExact } from '../../../../core/utils/money.util';
import { BILL_SERVICE_FEE_CENTS } from '../../../../core/utils/reload-commission.util';
import {
  ACCOUNT_MAX_LENGTH,
  AMOUNT_INPUT_MAX_LENGTH,
  BILL_PROVIDERS,
  BillFieldErrors,
  BillFieldKey,
} from '../../../../core/utils/reload-validation.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';

const FIELD_ID_PREFIX = 'bill-';

@Component({
  selector: 'app-bill-payment-card',
  imports: [...FIELD_IMPORTS, ButtonComponent, CardComponent],
  templateUrl: './bill-payment-card.component.html',
  styleUrl: './bill-payment-card.component.scss',
})
export class BillPaymentCardComponent {
  readonly canWrite = input(false);
  readonly paid = output<void>();

  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notificationService = inject(NotificationService);
  private readonly reloadService = inject(ReloadService);

  protected readonly providers = BILL_PROVIDERS;
  protected readonly accountMaxLength = ACCOUNT_MAX_LENGTH;
  protected readonly amountMaxLength = AMOUNT_INPUT_MAX_LENGTH;
  protected readonly feeHint = `Service fee ${formatRupeesExact(BILL_SERVICE_FEE_CENTS)} added at the counter.`;

  protected readonly provider = signal('');
  protected readonly account = signal('');
  protected readonly amount = signal('');
  protected readonly errors = signal<BillFieldErrors>({});
  protected readonly busy = signal(false);

  protected fieldId(key: BillFieldKey): string {
    return `${FIELD_ID_PREFIX}${key}`;
  }

  protected error(key: BillFieldKey): string | null {
    return this.errors()[key] ?? null;
  }

  protected onProviderChange(event: Event): void {
    this.provider.set((event.target as HTMLSelectElement).value);
    this.clearError('provider');
  }

  protected onAccountInput(event: Event): void {
    this.account.set((event.target as HTMLInputElement).value);
    this.clearError('account');
  }

  protected onAmountInput(event: Event): void {
    this.amount.set((event.target as HTMLInputElement).value);
    this.clearError('amount');
  }

  protected pay(event: Event): void {
    event.preventDefault();
    this.submit().catch(() => undefined);
  }

  private async submit(): Promise<void> {
    if (this.busy() || !this.canWrite()) return;
    this.busy.set(true);
    try {
      const result = await this.reloadService.payBill({
        provider: this.provider(),
        account: this.account(),
        amount: this.amount(),
      });
      if (result.ok) {
        this.notificationService.show(
          'success',
          `Bill paid. The customer pays ${formatRupeesExact(result.totalCents)}.`
        );
        this.reset();
        this.paid.emit();
        return;
      }
      this.errors.set(result.errors);
      if (result.reason === 'invalid') this.focusField(result.firstErrorField);
      else if (result.reason !== 'busy') {
        this.notificationService.show(
          'warning',
          'That bill was not paid. You may not have access to pay bills.'
        );
      }
    } finally {
      this.busy.set(false);
    }
  }

  private reset(): void {
    this.provider.set('');
    this.account.set('');
    this.amount.set('');
    this.errors.set({});
  }

  private clearError(key: BillFieldKey): void {
    if (this.errors()[key] === undefined) return;
    this.errors.update(current => ({ ...current, [key]: undefined }));
  }

  private focusField(key: BillFieldKey | null): void {
    if (key === null) return;
    this.hostElement.nativeElement.querySelector<HTMLElement>(`#${this.fieldId(key)}`)?.focus();
  }
}
