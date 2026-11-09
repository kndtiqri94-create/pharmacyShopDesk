import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CashEntry } from '../../../../core/models/domain/cash-entry.model';
import { ClockService } from '../../../../core/services/clock.service';
import { CashBookView, PosCashService } from '../../../../core/services/pos-cash.service';
import { formatDate, isIsoDate } from '../../../../core/utils/date.util';
import { formatRupeesExact } from '../../../../core/utils/money.util';
import { CashBookRow } from '../../../../core/utils/pos-cash-ledger.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PosDialogComponent } from '../pos-dialog/pos-dialog.component';

@Component({
  selector: 'app-cash-book-dialog',
  imports: [
    AlertComponent,
    ButtonComponent,
    DataTableComponent,
    PosDialogComponent,
    ...FIELD_IMPORTS,
  ],
  templateUrl: './cash-book-dialog.component.html',
  styleUrl: './cash-book-dialog.component.scss',
})
export class CashBookDialogComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly cashService = inject(PosCashService);
  private readonly clockService = inject(ClockService);

  protected readonly today = this.clockService.today();
  protected readonly date = signal(this.today);
  protected readonly view = signal<CashBookView | null>(null);
  protected readonly money = formatRupeesExact;
  protected readonly dateOf = formatDate;
  protected readonly columns: readonly DataTableColumn<CashBookRow>[] = [
    { key: 'time', label: 'Time', value: row => row.entry.time },
    { key: 'description', label: 'Description', value: row => row.entry.description },
    { key: 'in', label: 'Cash in', kind: 'money', value: row => this.amountIn(row.entry) },
    { key: 'out', label: 'Cash out', kind: 'money', value: row => this.amountOut(row.entry) },
    { key: 'balance', label: 'Balance', kind: 'money', value: row => row.balanceCents },
  ];

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.date.set(this.today);
          this.load();
        });
      }
    });
  }

  protected rowKey = (row: CashBookRow): string => row.entry.id;

  protected onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = isIsoDate(input.value) && input.value <= this.today ? input.value : this.today;
    input.value = chosen;
    this.date.set(chosen);
    this.load();
  }

  private amountIn(entry: CashEntry): number {
    return entry.direction === 'IN' ? entry.amountCents : 0;
  }

  private amountOut(entry: CashEntry): number {
    return entry.direction === 'OUT' ? entry.amountCents : 0;
  }

  private load(): void {
    this.cashService
      .view(this.date())
      .then(view => this.view.set(view))
      .catch(() => undefined);
  }
}
