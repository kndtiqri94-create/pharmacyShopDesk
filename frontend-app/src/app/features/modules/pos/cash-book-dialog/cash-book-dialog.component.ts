import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CashBookReport } from '../../../../core/models/domain/cash-book-ledger.model';
import { CashBookExportService } from '../../../../core/services/cash-book-export.service';
import { ClockService } from '../../../../core/services/clock.service';
import {
  CASH_BOOK_ADMIN_ONLY_MESSAGE,
  PosCashBookService,
} from '../../../../core/services/pos-cash-book.service';
import { differenceStatus } from '../../../../core/utils/cash-book-ledger.util';
import { formatDate } from '../../../../core/utils/date.util';
import { formatRupeesExact } from '../../../../core/utils/money.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { AddObDialogComponent } from '../add-ob-dialog/add-ob-dialog.component';
import { PosDialogComponent } from '../pos-dialog/pos-dialog.component';
import { ActualBalanceDialogComponent } from '../cash-book-actions/actual-balance-dialog/actual-balance-dialog.component';
import { AdjustmentDialogComponent } from '../cash-book-actions/adjustment-dialog/adjustment-dialog.component';

type CashBookAction = 'ACTUAL' | 'ADJUSTMENT' | 'OPENING';

@Component({
  selector: 'app-cash-book-dialog',
  imports: [
    ActualBalanceDialogComponent,
    AddObDialogComponent,
    AdjustmentDialogComponent,
    AlertComponent,
    ButtonComponent,
    PosDialogComponent,
    ...FIELD_IMPORTS,
  ],
  templateUrl: './cash-book-dialog.component.html',
  styleUrl: './cash-book-dialog.component.scss',
})
export class CashBookDialogComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly cashBookService = inject(PosCashBookService);
  private readonly exportService = inject(CashBookExportService);
  private readonly clockService = inject(ClockService);

  protected readonly today = this.clockService.today();
  protected readonly fromDraft = signal(this.today);
  protected readonly toDraft = signal(this.today);
  protected readonly report = signal<CashBookReport | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly action = signal<CashBookAction | null>(null);
  protected readonly busy = signal(false);
  protected readonly money = formatRupeesExact;
  protected readonly dateOf = formatDate;
  protected readonly status = differenceStatus;
  protected readonly adminOnlyMessage = CASH_BOOK_ADMIN_ONLY_MESSAGE;

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.reset());
    });
  }

  protected canRecord(): boolean {
    return this.cashBookService.canRecord();
  }

  protected onFromChange(event: Event): void {
    this.fromDraft.set((event.target as HTMLInputElement).value);
  }

  protected onToChange(event: Event): void {
    this.toDraft.set((event.target as HTMLInputElement).value);
  }

  protected filter(): void {
    this.load(this.fromDraft(), this.toDraft()).catch(() => undefined);
  }

  protected reset(): void {
    this.fromDraft.set(this.today);
    this.toDraft.set(this.today);
    this.action.set(null);
    this.load(this.today, this.today).catch(() => undefined);
  }

  protected refresh(): void {
    const current = this.report();
    if (current !== null) this.load(current.from, current.to).catch(() => undefined);
  }

  protected openAction(next: CashBookAction): void {
    if (this.canRecord() && this.report() !== null) this.action.set(next);
  }

  protected closeAction(): void {
    this.action.set(null);
    this.refresh();
  }

  protected exportCsv(): void {
    this.runExport(report => this.exportService.exportCsv(report));
  }

  protected exportPdf(): void {
    this.runExport(report => this.exportService.exportPdf(report));
  }

  private runExport(work: (report: CashBookReport) => Promise<unknown>): void {
    const current = this.report();
    if (current === null || this.busy()) return;
    this.busy.set(true);
    work(current)
      .catch(() => undefined)
      .finally(() => this.busy.set(false));
  }

  private async load(from: string, to: string): Promise<void> {
    const result = await this.cashBookService.loadRange(from, to);
    if (!result.ok) {
      this.message.set(result.message);
      return;
    }
    this.message.set(null);
    this.fromDraft.set(from);
    this.toDraft.set(to);
    this.report.set(result.report);
  }
}
