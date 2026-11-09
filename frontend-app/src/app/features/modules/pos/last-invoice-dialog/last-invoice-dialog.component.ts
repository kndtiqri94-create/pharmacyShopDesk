import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { SaleReturn } from '../../../../core/models/domain/sale-return.model';
import { Sale } from '../../../../core/models/domain/sale.model';
import { SalesDataService } from '../../../../core/services/data/sales-data.service';
import { formatDate, formatTime } from '../../../../core/utils/date.util';
import { formatMoneyCell, formatRupeesExact } from '../../../../core/utils/money.util';
import { formatSalePaymentMethod } from '../../../../core/utils/sale-payment-label.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PosDialogComponent } from '../pos-dialog/pos-dialog.component';
import { firstValueFrom } from 'rxjs';

export interface LastInvoicePrint {
  sale: Sale;
  returns: readonly SaleReturn[];
}

@Component({
  selector: 'app-last-invoice-dialog',
  imports: [AlertComponent, ButtonComponent, EmptyStateComponent, PosDialogComponent],
  templateUrl: './last-invoice-dialog.component.html',
  styleUrl: './last-invoice-dialog.component.scss',
})
export class LastInvoiceDialogComponent {
  readonly open = input(false);
  readonly closed = output<void>();
  readonly printRequested = output<LastInvoicePrint>();

  private readonly salesDataService = inject(SalesDataService);

  protected readonly sale = signal<Sale | null>(null);
  protected readonly returns = signal<readonly SaleReturn[]>([]);
  protected readonly loaded = signal(false);
  protected readonly money = formatRupeesExact;
  protected readonly cell = formatMoneyCell;
  protected readonly dateOf = formatDate;
  protected readonly timeOf = formatTime;
  protected readonly methodLabel = formatSalePaymentMethod;

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.load());
      else this.loaded.set(false);
    });
  }

  protected print(): void {
    const sale = this.sale();
    if (sale !== null) this.printRequested.emit({ sale, returns: this.returns() });
  }

  private load(): void {
    this.fetch().catch(() => undefined);
  }

  private async fetch(): Promise<void> {
    const [sales, returns] = await Promise.all([
      firstValueFrom(this.salesDataService.getSales()),
      firstValueFrom(this.salesDataService.getReturns()),
    ]);
    const latest = [...sales].sort(
      (first, second) =>
        second.createdAt.localeCompare(first.createdAt) || second.id.localeCompare(first.id)
    )[0];
    this.sale.set(latest ?? null);
    this.returns.set(returns.filter(item => item.originalSaleId === latest?.id));
    this.loaded.set(true);
  }
}
