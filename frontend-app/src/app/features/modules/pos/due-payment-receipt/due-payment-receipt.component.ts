import { Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DuePayment } from '../../../../core/models/domain/due-payment.model';
import { SettingsDataService } from '../../../../core/services/data/settings-data.service';
import { formatDate, formatTime } from '../../../../core/utils/date.util';
import { formatRupeesExact } from '../../../../core/utils/money.util';
import { formatSalePaymentMethod } from '../../../../core/utils/sale-payment-label.util';
import { PosPrintSheetComponent } from '../pos-print-sheet/pos-print-sheet.component';

@Component({
  selector: 'app-due-payment-receipt',
  imports: [PosPrintSheetComponent],
  templateUrl: './due-payment-receipt.component.html',
  styleUrl: './due-payment-receipt.component.scss',
})
export class DuePaymentReceiptComponent {
  readonly payment = input<DuePayment | null>(null);
  readonly closed = output<void>();

  private readonly settingsDataService = inject(SettingsDataService);

  protected readonly settings = toSignal(this.settingsDataService.get(), { initialValue: null });
  protected readonly money = formatRupeesExact;
  protected readonly dateOf = formatDate;
  protected readonly timeOf = formatTime;
  protected readonly methodLabel = formatSalePaymentMethod;
}
