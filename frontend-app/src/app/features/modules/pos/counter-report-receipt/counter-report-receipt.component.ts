import { Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CounterReport } from '../../../../core/models/domain/counter-report.model';
import { SettingsDataService } from '../../../../core/services/data/settings-data.service';
import { formatDate, formatTime } from '../../../../core/utils/date.util';
import { formatRupeesExact } from '../../../../core/utils/money.util';
import { COUNTER_OUTCOME_LABELS, counterOutcome } from '../../../../core/utils/pos-counter.util';
import { PosPrintSheetComponent } from '../pos-print-sheet/pos-print-sheet.component';

@Component({
  selector: 'app-counter-report-receipt',
  imports: [PosPrintSheetComponent],
  templateUrl: './counter-report-receipt.component.html',
  styleUrl: './counter-report-receipt.component.scss',
})
export class CounterReportReceiptComponent {
  readonly report = input<CounterReport | null>(null);
  readonly closed = output<void>();

  private readonly settingsDataService = inject(SettingsDataService);

  protected readonly settings = toSignal(this.settingsDataService.get(), { initialValue: null });
  protected readonly money = formatRupeesExact;
  protected readonly dateOf = formatDate;
  protected readonly timeOf = formatTime;

  protected outcomeLabel(report: CounterReport): string {
    return COUNTER_OUTCOME_LABELS[counterOutcome(report.differenceCents)];
  }
}
