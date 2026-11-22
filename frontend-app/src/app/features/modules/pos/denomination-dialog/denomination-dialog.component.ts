import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import {
  DenominationEntry,
  MAX_DENOMINATION_COUNT,
  summarizeDenominations,
} from '../../../../core/utils/denomination.util';
import { formatMoneyCell, formatRupeesExact } from '../../../../core/utils/money.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { PosDialogComponent } from '../pos-dialog/pos-dialog.component';

const COUNT_TEXT_MAX_LENGTH = String(MAX_DENOMINATION_COUNT).length;
const FIX_COUNTS_MESSAGE = 'Fix the counts marked below, then use the total.';

@Component({
  selector: 'app-denomination-dialog',
  imports: [ButtonComponent, PosDialogComponent],
  templateUrl: './denomination-dialog.component.html',
  styleUrl: './denomination-dialog.component.scss',
})
export class DenominationDialogComponent {
  readonly open = input(false);
  readonly confirmed = output<number>();
  readonly closed = output<void>();

  protected readonly texts = signal<Readonly<Record<number, string>>>({});
  protected readonly refused = signal<string | null>(null);
  protected readonly countMaxLength = COUNT_TEXT_MAX_LENGTH;
  protected readonly money = formatRupeesExact;
  protected readonly cell = formatMoneyCell;
  protected readonly summary = computed(() => summarizeDenominations(this.texts()));

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.texts.set({});
          this.refused.set(null);
        });
      }
    });
  }

  protected countText(entry: DenominationEntry): string {
    return this.texts()[entry.denomination.valueRupees] ?? '';
  }

  protected onCount(entry: DenominationEntry, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.texts.update(current => ({ ...current, [entry.denomination.valueRupees]: value }));
    this.refused.set(null);
  }

  protected confirm(): void {
    const summary = this.summary();
    if (!summary.valid) {
      this.refused.set(summary.totalError ?? FIX_COUNTS_MESSAGE);
      return;
    }
    this.confirmed.emit(summary.totalCents);
  }
}
