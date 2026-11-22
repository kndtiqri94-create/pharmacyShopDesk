import { Component, computed, inject, output, signal } from '@angular/core';
import { SaleReturn } from '../../../../core/models/domain/sale-return.model';
import {
  RETURN_SETTLEMENT_LABELS,
  ReturnSettlement,
} from '../../../../core/models/enums/return-settlement.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosReturnService } from '../../../../core/services/pos-return.service';
import { PosService } from '../../../../core/services/pos.service';
import { formatDate, formatTime } from '../../../../core/utils/date.util';
import { formatRupeesExact } from '../../../../core/utils/money.util';
import { LOOKUP_TEXT_MAX_LENGTH, ReturnableLine } from '../../../../core/utils/pos-return.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';

interface ReturnRow {
  line: ReturnableLine;
  error: string | null;
}

@Component({
  selector: 'app-pos-return-panel',
  imports: [
    AlertComponent,
    ButtonComponent,
    DataTableCellDirective,
    DataTableComponent,
    ...FIELD_IMPORTS,
  ],
  templateUrl: './pos-return-panel.component.html',
  styleUrl: './pos-return-panel.component.scss',
})
export class PosReturnPanelComponent {
  readonly returnCompleted = output<SaleReturn>();
  readonly printRequested = output<SaleReturn>();

  private readonly notificationService = inject(NotificationService);
  private readonly posService = inject(PosService);

  protected readonly returnService = inject(PosReturnService);
  protected readonly invoiceText = signal('');
  protected readonly returnText = signal('');
  protected readonly lookupMessage = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly lookupMaxLength = LOOKUP_TEXT_MAX_LENGTH;
  protected readonly money = formatRupeesExact;
  protected readonly dateOf = formatDate;
  protected readonly timeOf = formatTime;
  protected readonly settlementLabels = RETURN_SETTLEMENT_LABELS;
  protected readonly canReturn = this.posService.canSell;
  protected readonly columns: readonly DataTableColumn<ReturnRow>[] = [
    { key: 'item', label: 'Item', value: row => row.line.name, subValue: row => row.line.sku },
    { key: 'sold', label: 'Sold', kind: 'number', value: row => row.line.soldQuantity },
    {
      key: 'returned',
      label: 'Returned',
      kind: 'number',
      value: row => row.line.returnedQuantity,
    },
    {
      key: 'returnable',
      label: 'Can return',
      kind: 'number',
      value: row => row.line.returnableQuantity,
    },
    { key: 'price', label: 'Price', kind: 'money', value: row => row.line.unitPriceCents },
    { key: 'quantity', label: 'Return qty' },
    { key: 'value', label: 'Value', kind: 'money', value: row => this.valueOf(row) },
  ];
  protected readonly rows = computed<ReturnRow[]>(() => {
    const errors = this.returnService.selection().errors;
    return this.returnService
      .lines()
      .map(line => ({ line, error: errors[line.productId] ?? null }));
  });

  protected rowKey = (row: ReturnRow): string => row.line.productId;

  protected quantityText(row: ReturnRow): string {
    return this.returnService.quantities()[row.line.productId] ?? '';
  }

  protected onQuantityInput(row: ReturnRow, event: Event): void {
    this.returnService.setQuantity(row.line.productId, (event.target as HTMLInputElement).value);
  }

  protected onInvoiceInput(event: Event): void {
    this.invoiceText.set((event.target as HTMLInputElement).value);
  }

  protected onReturnInput(event: Event): void {
    this.returnText.set((event.target as HTMLInputElement).value);
  }

  protected findInvoice(): void {
    this.returnService
      .findInvoice(this.invoiceText())
      .then(result => this.lookupMessage.set(result.ok ? null : result.message))
      .catch(() => undefined);
  }

  protected findReturn(): void {
    this.returnService
      .findReturn(this.returnText())
      .then(result => this.lookupMessage.set(result.ok ? null : result.message))
      .catch(() => undefined);
  }

  protected chooseSettlement(settlement: ReturnSettlement): void {
    this.returnService.setSettlement(settlement);
  }

  protected complete(): void {
    this.completeReturn().catch(() => undefined);
  }

  protected clear(): void {
    this.returnService.reset();
    this.lookupMessage.set(null);
  }

  private valueOf(row: ReturnRow): number {
    const pick = this.returnService
      .selection()
      .picks.find(candidate => candidate.line.productId === row.line.productId);
    return pick?.valueCents ?? 0;
  }

  private async completeReturn(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.returnService.complete();
      if (!result.ok) {
        this.notificationService.show('warning', result.message);
        return;
      }
      await this.posService.refreshProducts();
      this.invoiceText.set('');
      this.lookupMessage.set(null);
      this.notificationService.show('success', `Return ${result.saleReturn.returnNo} saved.`);
      this.returnCompleted.emit(result.saleReturn);
    } finally {
      this.busy.set(false);
    }
  }
}
