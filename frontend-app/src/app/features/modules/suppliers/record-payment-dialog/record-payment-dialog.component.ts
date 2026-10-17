import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { formatRupeesExact, formatRupeesInput } from '../../../../core/utils/money.util';
import {
  PAYMENT_AMOUNT_MAX_LENGTH,
  validatePaymentAmount,
} from '../../../../core/utils/supplier-payment-validation.util';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';

export const PAYMENT_AMOUNT_FIELD_ID = 'record-payment-amount';

@Component({
  selector: 'app-record-payment-dialog',
  imports: [...FIELD_IMPORTS, ConfirmDialogComponent],
  templateUrl: './record-payment-dialog.component.html',
  styleUrl: './record-payment-dialog.component.scss',
})
export class RecordPaymentDialogComponent {
  readonly open = input(false);
  readonly supplierName = input.required<string>();
  readonly owedCents = input.required<number>();
  readonly busy = input(false);
  readonly serverError = input<string | null>(null);
  readonly confirmed = output<number>();
  readonly cancelled = output<void>();

  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly amountMaxLength = PAYMENT_AMOUNT_MAX_LENGTH;
  protected readonly amountId = PAYMENT_AMOUNT_FIELD_ID;
  protected readonly owedText = computed(() => formatRupeesExact(this.owedCents()));
  protected readonly amount = linkedSignal(() => {
    this.open();
    return formatRupeesInput(this.owedCents());
  });
  protected readonly submitted = linkedSignal(() => {
    this.open();
    return false;
  });
  private readonly shownServerError = linkedSignal(() => this.serverError());
  protected readonly error = computed(() => {
    const server = this.shownServerError();
    if (server !== null) return server;
    if (!this.submitted()) return null;
    return validatePaymentAmount(this.amount(), this.owedCents()).error;
  });

  protected onInput(event: Event): void {
    this.amount.set((event.target as HTMLInputElement).value);
    this.submitted.set(false);
    this.shownServerError.set(null);
  }

  protected submit(): void {
    if (this.busy()) return;
    this.submitted.set(true);
    const result = validatePaymentAmount(this.amount(), this.owedCents());
    if (result.amountCents === null) {
      this.hostElement.nativeElement.querySelector<HTMLElement>(`#${this.amountId}`)?.focus();
      return;
    }
    this.confirmed.emit(result.amountCents);
  }
}
