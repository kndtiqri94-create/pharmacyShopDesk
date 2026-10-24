import { Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';
import { HeldBill } from '../../../../core/models/domain/held-bill.model';
import { formatTime } from '../../../../core/utils/date.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { syncDialogState } from '../../../../shared/utils/dialog.util';
import { createUniqueId } from '../../../../shared/utils/unique-id.util';

@Component({
  selector: 'app-held-bills-dialog',
  imports: [ButtonComponent, DataTableCellDirective, DataTableComponent],
  templateUrl: './held-bills-dialog.component.html',
  styleUrl: './held-bills-dialog.component.scss',
})
export class HeldBillsDialogComponent {
  readonly open = input(false);
  readonly heldBills = input.required<readonly HeldBill[]>();
  readonly busy = input(false);
  readonly canChange = input(true);
  readonly resumed = output<string>();
  readonly discarded = output<string>();
  readonly closed = output<void>();

  protected readonly titleId = createUniqueId('held-title');
  protected readonly discardingId = signal<string | null>(null);
  protected readonly columns: readonly DataTableColumn<HeldBill>[] = [
    { key: 'holdNo', label: 'Hold no', kind: 'code' },
    { key: 'customerName', label: 'Customer' },
    { key: 'itemCount', label: 'Items', kind: 'number' },
    { key: 'totalCents', label: 'Total', kind: 'money' },
    { key: 'heldAt', label: 'Time', value: row => formatTime(row.heldAt) },
    { key: 'action', label: 'Action' },
  ];

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const open = this.open();
      syncDialogState(this.dialog().nativeElement, open);
      if (!open) this.discardingId.set(null);
    });
  }

  protected rowKey = (row: HeldBill): string => row.id;

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }

  protected askDiscard(id: string): void {
    this.discardingId.set(id);
  }

  protected keep(): void {
    this.discardingId.set(null);
  }

  protected confirmDiscard(id: string): void {
    this.discardingId.set(null);
    this.discarded.emit(id);
  }
}
