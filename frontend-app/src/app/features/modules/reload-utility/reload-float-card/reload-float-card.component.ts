import { Component, computed, input } from '@angular/core';
import { ReloadFloat } from '../../../../core/models/domain/reload-float.model';
import { formatCount, formatRupees, formatRupeesExact } from '../../../../core/utils/money.util';
import { FLOAT_FULL_CENTS } from '../../../../core/utils/reload-commission.util';
import {
  floatProgressValue,
  floatWarningText,
  isFloatLow,
} from '../../../../core/utils/reload-summary.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ProgressBarComponent } from '../../../../shared/components/progress-bar/progress-bar.component';

@Component({
  selector: 'app-reload-float-card',
  imports: [AlertComponent, CardComponent, ProgressBarComponent],
  templateUrl: './reload-float-card.component.html',
  styleUrl: './reload-float-card.component.scss',
})
export class ReloadFloatCardComponent {
  readonly float = input.required<ReloadFloat | null>();
  readonly lowFloatCents = input.required<number>();

  protected readonly fullCents = FLOAT_FULL_CENTS;
  protected readonly progressLabel = `Available float against a full float of ${formatRupees(FLOAT_FULL_CENTS)}`;
  protected readonly low = computed(() => isFloatLow(this.float(), this.lowFloatCents()));
  protected readonly warning = computed(() => floatWarningText(this.lowFloatCents()));
  protected readonly view = computed(() => {
    const current = this.float();
    if (current === null) return null;
    return {
      available: formatRupees(current.availableCents),
      progress: floatProgressValue(current.availableCents),
      reloads: formatCount(current.reloadsCount),
      bills: formatCount(current.billsCount),
      commission: formatRupeesExact(current.commissionCents),
    };
  });
}
