import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Quotation } from '../../../../core/models/domain/quotation.model';
import {
  QUOTATION_STATUS_LABELS,
  QuotationStatus,
} from '../../../../core/models/enums/quotation-status.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosQuotationService } from '../../../../core/services/pos-quotation.service';
import { formatDate } from '../../../../core/utils/date.util';
import { formatMoneyCell, formatRupeesExact } from '../../../../core/utils/money.util';
import { lineTotalCents } from '../../../../core/utils/pos-totals.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { PosDialogComponent } from '../pos-dialog/pos-dialog.component';

@Component({
  selector: 'app-quotations-dialog',
  imports: [
    BadgeComponent,
    ButtonComponent,
    DataTableCellDirective,
    DataTableComponent,
    PosDialogComponent,
  ],
  templateUrl: './quotations-dialog.component.html',
  styleUrl: './quotations-dialog.component.scss',
})
export class QuotationsDialogComponent {
  readonly open = input(false);
  readonly canChange = input(true);
  readonly closed = output<void>();
  readonly convertRequested = output<string>();

  private readonly notificationService = inject(NotificationService);
  private readonly quotationService = inject(PosQuotationService);

  protected readonly quotations = signal<readonly Quotation[]>([]);
  protected readonly viewingId = signal<string | null>(null);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly money = formatRupeesExact;
  protected readonly cell = formatMoneyCell;
  protected readonly statusLabels = QUOTATION_STATUS_LABELS;
  protected readonly openStatus = QuotationStatus.OPEN;
  protected readonly viewing = computed(
    () => this.quotations().find(candidate => candidate.id === this.viewingId()) ?? null
  );
  protected readonly columns: readonly DataTableColumn<Quotation>[] = [
    { key: 'quotationNo', label: 'Quotation no', kind: 'code' },
    { key: 'customerName', label: 'Customer' },
    { key: 'date', label: 'Date', value: row => formatDate(row.date) },
    { key: 'itemCount', label: 'Items', kind: 'number' },
    { key: 'totalCents', label: 'Total', kind: 'money' },
    { key: 'status', label: 'Status' },
    { key: 'action', label: 'Action' },
  ];

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.refresh());
      else this.reset();
    });
  }

  protected rowKey = (row: Quotation): string => row.id;

  protected lineTotal(line: Quotation['bill']['lines'][number]): number {
    return lineTotalCents(line);
  }

  protected statusLabel(status: QuotationStatus): string {
    return QUOTATION_STATUS_LABELS[status];
  }

  protected view(id: string): void {
    this.viewingId.set(id);
  }

  protected back(): void {
    this.viewingId.set(null);
  }

  protected askDelete(id: string): void {
    this.deletingId.set(id);
  }

  protected keep(): void {
    this.deletingId.set(null);
  }

  protected confirmDelete(id: string): void {
    this.deleteQuotation(id).catch(() => undefined);
  }

  private reset(): void {
    this.viewingId.set(null);
    this.deletingId.set(null);
  }

  private refresh(): void {
    this.quotationService
      .list()
      .then(list => this.quotations.set(list))
      .catch(() => undefined);
  }

  private async deleteQuotation(id: string): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.quotationService.remove(id);
      this.deletingId.set(null);
      this.notificationService.show(
        result.ok ? 'success' : 'warning',
        result.ok ? 'Quotation deleted.' : result.message
      );
      this.quotations.set(await this.quotationService.list());
    } finally {
      this.busy.set(false);
    }
  }
}
