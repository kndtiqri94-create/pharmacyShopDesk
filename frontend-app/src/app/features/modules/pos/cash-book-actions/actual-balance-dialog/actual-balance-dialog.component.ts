import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NotificationService } from '../../../../../core/services/notification.service';
import { PosCashBookService } from '../../../../../core/services/pos-cash-book.service';
import { formatDate } from '../../../../../core/utils/date.util';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../../shared/components/field/field.imports';
import { PosDialogComponent } from '../../pos-dialog/pos-dialog.component';

@Component({
  selector: 'app-actual-balance-dialog',
  imports: [ButtonComponent, PosDialogComponent, ...FIELD_IMPORTS],
  templateUrl: './actual-balance-dialog.component.html',
})
export class ActualBalanceDialogComponent {
  readonly open = input(false);
  readonly date = input.required<string>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly cashBookService = inject(PosCashBookService);
  private readonly notificationService = inject(NotificationService);

  protected readonly amountText = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly dateOf = formatDate;

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.amountText.set('');
          this.error.set(null);
        });
      }
    });
  }

  protected onAmountInput(event: Event): void {
    this.amountText.set((event.target as HTMLInputElement).value);
    this.error.set(null);
  }

  protected save(): void {
    this.submit().catch(() => undefined);
  }

  private async submit(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.cashBookService.saveActualBalance(this.date(), this.amountText());
      if (!result.ok) {
        this.error.set(result.message);
        return;
      }
      this.notificationService.show('success', 'Actual balance saved.');
      this.saved.emit();
      this.closed.emit();
    } finally {
      this.busy.set(false);
    }
  }
}
