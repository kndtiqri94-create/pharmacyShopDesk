import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Sale } from '../../../../core/models/domain/sale.model';
import { SettingsDataService } from '../../../../core/services/data/settings-data.service';
import { formatDate, formatTime } from '../../../../core/utils/date.util';
import { formatMoneyCell, formatRupeesExact } from '../../../../core/utils/money.util';
import { formatSalePaymentMethod } from '../../../../core/utils/sale-payment-label.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { createUniqueId } from '../../../../shared/utils/unique-id.util';

const PRINTING_CLASS = 'sd-printing-receipt';

@Component({
  selector: 'app-pos-receipt',
  imports: [ButtonComponent, CdkTrapFocus],
  templateUrl: './pos-receipt.component.html',
  styleUrl: './pos-receipt.component.scss',
})
export class PosReceiptComponent {
  readonly sale = input<Sale | null>(null);
  readonly closed = output<void>();

  private readonly document = inject(DOCUMENT);
  private readonly settingsDataService = inject(SettingsDataService);

  protected readonly titleId = createUniqueId('receipt-title');
  protected readonly settings = toSignal(this.settingsDataService.get(), { initialValue: null });
  protected readonly money = formatRupeesExact;
  protected readonly cell = formatMoneyCell;
  protected readonly dateOf = formatDate;
  protected readonly timeOf = formatTime;
  protected readonly methodLabel = formatSalePaymentMethod;

  constructor() {
    effect(() => {
      const classList = this.document.body.classList;
      if (this.sale() === null) classList.remove(PRINTING_CLASS);
      else classList.add(PRINTING_CLASS);
    });
    inject(DestroyRef).onDestroy(() => this.document.body.classList.remove(PRINTING_CLASS));
  }

  protected print(): void {
    this.document.defaultView?.print();
  }
}
