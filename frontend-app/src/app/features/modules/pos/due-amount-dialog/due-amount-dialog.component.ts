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
import { CustomerDue } from '../../../../core/models/domain/customer-due.model';
import { DuePayment } from '../../../../core/models/domain/due-payment.model';
import { SalePaymentMethod } from '../../../../core/models/enums/sale-payment-method.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosDueService } from '../../../../core/services/pos-due.service';
import { formatRupeesExact } from '../../../../core/utils/money.util';
import { DUE_PAYMENT_METHODS, filterDues } from '../../../../core/utils/pos-due.util';
import { formatSalePaymentMethod } from '../../../../core/utils/sale-payment-label.util';
import { SEARCH_TEXT_MAX_LENGTH } from '../../../../core/utils/pos-search.util';
import { REFERENCE_MAX_LENGTH } from '../../../../core/utils/pos-validation.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PosDialogComponent } from '../pos-dialog/pos-dialog.component';

@Component({
  selector: 'app-due-amount-dialog',
  imports: [
    AlertComponent,
    ButtonComponent,
    DataTableCellDirective,
    DataTableComponent,
    PosDialogComponent,
    ...FIELD_IMPORTS,
  ],
  templateUrl: './due-amount-dialog.component.html',
  styleUrl: './due-amount-dialog.component.scss',
})
export class DueAmountDialogComponent {
  readonly open = input(false);
  readonly canChange = input(true);
  readonly closed = output<void>();
  readonly printRequested = output<DuePayment>();

  private readonly dueService = inject(PosDueService);
  private readonly notificationService = inject(NotificationService);

  protected readonly dues = signal<readonly CustomerDue[]>([]);
  protected readonly loaded = signal(false);
  protected readonly search = signal('');
  protected readonly selected = signal<CustomerDue | null>(null);
  protected readonly amountText = signal('');
  protected readonly method = signal<SalePaymentMethod>(SalePaymentMethod.CASH);
  protected readonly reference = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly lastPayment = signal<DuePayment | null>(null);
  protected readonly busy = signal(false);
  protected readonly money = formatRupeesExact;
  protected readonly methods = DUE_PAYMENT_METHODS;
  protected readonly methodLabel = formatSalePaymentMethod;
  protected readonly searchMaxLength = SEARCH_TEXT_MAX_LENGTH;
  protected readonly referenceMaxLength = REFERENCE_MAX_LENGTH;
  protected readonly cash = SalePaymentMethod.CASH;
  protected readonly visible = computed(() => filterDues(this.dues(), this.search()));
  protected readonly columns: readonly DataTableColumn<CustomerDue>[] = [
    { key: 'name', label: 'Customer' },
    { key: 'owedCents', label: 'Owes', kind: 'money' },
    { key: 'action', label: 'Action' },
  ];

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.start());
    });
  }

  protected rowKey = (row: CustomerDue): string => row.customerId;

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onAmountInput(event: Event): void {
    this.amountText.set((event.target as HTMLInputElement).value);
    this.error.set(null);
  }

  protected onMethodChange(event: Event): void {
    const chosen = this.methods.find(item => item === (event.target as HTMLSelectElement).value);
    if (chosen !== undefined) this.method.set(chosen);
  }

  protected onReferenceInput(event: Event): void {
    this.reference.set((event.target as HTMLInputElement).value);
  }

  protected choose(due: CustomerDue): void {
    this.selected.set(due);
    this.amountText.set('');
    this.reference.set('');
    this.error.set(null);
    this.lastPayment.set(null);
    this.method.set(SalePaymentMethod.CASH);
  }

  protected cancelPayment(): void {
    this.selected.set(null);
  }

  protected save(): void {
    this.takePayment().catch(() => undefined);
  }

  private start(): void {
    this.selected.set(null);
    this.lastPayment.set(null);
    this.search.set('');
    this.refresh().catch(() => undefined);
  }

  private async refresh(): Promise<void> {
    this.dues.set(await this.dueService.list());
    this.loaded.set(true);
  }

  private async takePayment(): Promise<void> {
    const due = this.selected();
    if (due === null) return;
    this.busy.set(true);
    try {
      const result = await this.dueService.takePayment(
        due.customerId,
        this.amountText(),
        this.method(),
        this.reference()
      );
      if (!result.ok) {
        this.error.set(result.message);
        return;
      }
      this.notificationService.show('success', `Payment ${result.payment.receiptNo} saved.`);
      this.lastPayment.set(result.payment);
      this.selected.set(null);
      await this.refresh();
    } finally {
      this.busy.set(false);
    }
  }
}
