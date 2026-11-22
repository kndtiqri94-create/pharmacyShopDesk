import { Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SaleReturn } from '../../../../core/models/domain/sale-return.model';
import { RETURN_SETTLEMENT_LABELS } from '../../../../core/models/enums/return-settlement.enum';
import { SettingsDataService } from '../../../../core/services/data/settings-data.service';
import { formatDate, formatTime } from '../../../../core/utils/date.util';
import { formatMoneyCell, formatRupeesExact } from '../../../../core/utils/money.util';
import { PosPrintSheetComponent } from '../pos-print-sheet/pos-print-sheet.component';

@Component({
  selector: 'app-pos-return-receipt',
  imports: [PosPrintSheetComponent],
  templateUrl: './pos-return-receipt.component.html',
  styleUrl: './pos-return-receipt.component.scss',
})
export class PosReturnReceiptComponent {
  readonly saleReturn = input<SaleReturn | null>(null);
  readonly closed = output<void>();

  private readonly settingsDataService = inject(SettingsDataService);

  protected readonly settings = toSignal(this.settingsDataService.get(), { initialValue: null });
  protected readonly money = formatRupeesExact;
  protected readonly cell = formatMoneyCell;
  protected readonly dateOf = formatDate;
  protected readonly timeOf = formatTime;
  protected readonly settlementLabels = RETURN_SETTLEMENT_LABELS;
}
