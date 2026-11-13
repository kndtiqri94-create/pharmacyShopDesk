import { Component, computed, inject, output, signal } from '@angular/core';
import { BillLine } from '../../../../core/models/domain/bill-line.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosService } from '../../../../core/services/pos.service';
import { lineTotalCents } from '../../../../core/utils/pos-totals.util';
import { DISCOUNT_TEXT_MAX_LENGTH } from '../../../../core/utils/pos-discount.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { PendingApproval } from '../pending-approval.model';

interface BillRow {
  serial: number;
  line: BillLine;
  totalCents: number;
}

const QUANTITY_TEXT_MAX_LENGTH = 5;
const COARSE_POINTER_QUERY = '(pointer: coarse)';

@Component({
  selector: 'app-pos-bill-lines',
  imports: [ButtonComponent, DataTableCellDirective, DataTableComponent],
  templateUrl: './pos-bill-lines.component.html',
  styleUrl: './pos-bill-lines.component.scss',
})
export class PosBillLinesComponent {
  readonly approvalRequested = output<PendingApproval>();
  readonly detailsRequested = output<string>();

  private readonly notificationService = inject(NotificationService);

  protected readonly posService = inject(PosService);
  protected readonly discountMaxLength = DISCOUNT_TEXT_MAX_LENGTH;
  protected readonly quantityMaxLength = QUANTITY_TEXT_MAX_LENGTH;
  protected readonly buttonSize = signal<'lg' | 'xl'>('lg');
  protected readonly columns: readonly DataTableColumn<BillRow>[] = [
    { key: 'serial', label: 'S/N', kind: 'number' },
    { key: 'description', label: 'Description', value: row => row.line.name },
    { key: 'price', label: 'Sale Price', kind: 'money', value: row => row.line.unitPriceCents },
    { key: 'discount', label: 'Discount %' },
    { key: 'quantity', label: 'QTY' },
    { key: 'action', label: 'Action' },
    { key: 'total', label: 'Total', kind: 'money', value: row => row.totalCents },
  ];
  protected readonly rows = computed<BillRow[]>(() => {
    const bill = this.posService.bill();
    return bill.lines.map((line, index) => ({
      serial: index + 1,
      line,
      totalCents: lineTotalCents(line),
    }));
  });
  protected readonly discountEditable = computed(
    () => this.posService.settings().lineDiscountEnabled && this.posService.canSell()
  );

  constructor() {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(COARSE_POINTER_QUERY);
    this.buttonSize.set(query.matches ? 'xl' : 'lg');
    query.addEventListener('change', event => this.buttonSize.set(event.matches ? 'xl' : 'lg'));
  }

  protected rowKey = (row: BillRow): string => row.line.productId;

  protected showDetails(row: BillRow): void {
    this.detailsRequested.emit(row.line.productId);
  }

  protected onQuantityChange(row: BillRow, event: Event): void {
    const input = event.target as HTMLInputElement;
    const result = this.posService.setQuantity(row.line.productId, input.value);
    if (!result.ok) this.notificationService.show('warning', result.message);
    input.value = String(this.currentLine(row)?.quantity ?? row.line.quantity);
  }

  protected onDiscountChange(row: BillRow, event: Event): void {
    const input = event.target as HTMLInputElement;
    const outcome = this.posService.evaluateLineDiscount(row.line.productId, input.value);
    if (outcome.kind === 'REFUSED') this.notificationService.show('warning', outcome.message);
    if (outcome.kind === 'NEEDS_APPROVAL') {
      this.approvalRequested.emit({ request: outcome.request, billInput: null });
    }
    input.value = String(this.currentLine(row)?.discountPercent ?? row.line.discountPercent);
  }

  protected remove(row: BillRow): void {
    const result = this.posService.removeLine(row.line.productId);
    if (!result.ok) this.notificationService.show('warning', result.message);
  }

  private currentLine(row: BillRow): BillLine | undefined {
    return this.posService.bill().lines.find(line => line.productId === row.line.productId);
  }
}
