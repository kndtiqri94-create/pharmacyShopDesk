import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import {
  TOP_UP_INPUT_MAX_LENGTH,
  validateTopUp,
} from '../../../../core/utils/reload-validation.util';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';

export const TOP_UP_AMOUNT_FIELD_ID = 'top-up-amount';

@Component({
  selector: 'app-top-up-dialog',
  imports: [...FIELD_IMPORTS, ConfirmDialogComponent],
  templateUrl: './top-up-dialog.component.html',
  styleUrl: './top-up-dialog.component.scss',
})
export class TopUpDialogComponent {
  readonly open = input(false);
  readonly busy = input(false);
  readonly serverError = input<string | null>(null);
  readonly confirmed = output<number>();
  readonly cancelled = output<void>();

  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly amountMaxLength = TOP_UP_INPUT_MAX_LENGTH;
  protected readonly amountId = TOP_UP_AMOUNT_FIELD_ID;
  protected readonly amount = linkedSignal(() => {
    this.open();
    return '';
  });
  protected readonly submitted = linkedSignal(() => {
    this.open();
    return false;
  });
  private readonly shownServerError = linkedSignal(() => this.serverError());
  protected readonly error = computed(() => {
    const server = this.shownServerError();
    if (server !== null) return server;
    return this.submitted() ? validateTopUp(this.amount()).error : null;
  });

  protected onInput(event: Event): void {
    this.amount.set((event.target as HTMLInputElement).value);
    this.submitted.set(false);
    this.shownServerError.set(null);
  }

  protected submit(): void {
    if (this.busy()) return;
    this.submitted.set(true);
    const result = validateTopUp(this.amount());
    if (result.amountCents === null) {
      this.hostElement.nativeElement.querySelector<HTMLElement>(`#${this.amountId}`)?.focus();
      return;
    }
    this.confirmed.emit(result.amountCents);
  }
}
