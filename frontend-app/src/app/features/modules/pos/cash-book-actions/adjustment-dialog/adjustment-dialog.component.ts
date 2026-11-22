import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NotificationService } from '../../../../../core/services/notification.service';
import { PosCashBookService } from '../../../../../core/services/pos-cash-book.service';
import { MAX_ADJUSTMENT_NOTE_LENGTH } from '../../../../../core/utils/cash-book-validation.util';
import { formatDate } from '../../../../../core/utils/date.util';
import { AlertComponent } from '../../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../../shared/components/field/field.imports';
import { PosDialogComponent } from '../../pos-dialog/pos-dialog.component';

@Component({
  selector: 'app-adjustment-dialog',
  imports: [AlertComponent, ButtonComponent, PosDialogComponent, ...FIELD_IMPORTS],
  templateUrl: './adjustment-dialog.component.html',
})
export class AdjustmentDialogComponent {
  readonly open = input(false);
  readonly date = input.required<string>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly cashBookService = inject(PosCashBookService);
  private readonly notificationService = inject(NotificationService);

  protected readonly amountText = signal('');
  protected readonly noteText = signal('');
  protected readonly amountError = signal<string | null>(null);
  protected readonly noteError = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly dateOf = formatDate;
  protected readonly noteMaxLength = MAX_ADJUSTMENT_NOTE_LENGTH;

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.reset());
    });
  }

  protected onAmountInput(event: Event): void {
    this.amountText.set((event.target as HTMLInputElement).value);
    this.amountError.set(null);
    this.formError.set(null);
  }

  protected onNoteInput(event: Event): void {
    this.noteText.set((event.target as HTMLTextAreaElement).value);
    this.noteError.set(null);
    this.formError.set(null);
  }

  protected save(): void {
    this.submit().catch(() => undefined);
  }

  private reset(): void {
    this.amountText.set('');
    this.noteText.set('');
    this.amountError.set(null);
    this.noteError.set(null);
    this.formError.set(null);
  }

  private async submit(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.cashBookService.addAdjustment(
        this.date(),
        this.amountText(),
        this.noteText()
      );
      if (result.ok) {
        this.notificationService.show('success', 'Adjustment saved.');
        this.saved.emit();
        this.closed.emit();
        return;
      }
      this.showFailure(result.message, result.field);
    } finally {
      this.busy.set(false);
    }
  }

  private showFailure(message: string, field: 'amount' | 'note' | undefined): void {
    this.amountError.set(field === 'amount' ? message : null);
    this.noteError.set(field === 'note' ? message : null);
    this.formError.set(field === undefined ? message : null);
  }
}
