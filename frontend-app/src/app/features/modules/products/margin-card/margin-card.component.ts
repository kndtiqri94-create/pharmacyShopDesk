import { Component, computed, input } from '@angular/core';
import { MarginResult } from '../../../../core/utils/margin.util';
import { formatPercent, formatRupees } from '../../../../core/utils/money.util';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ProgressBarComponent } from '../../../../shared/components/progress-bar/progress-bar.component';

const FULL_BAR = 100;

@Component({
  selector: 'app-margin-card',
  imports: [CardComponent, ProgressBarComponent],
  templateUrl: './margin-card.component.html',
  styleUrl: './margin-card.component.scss',
})
export class MarginCardComponent {
  readonly margin = input.required<MarginResult>();
  readonly unit = input.required<string>();

  protected readonly percentText = computed(() => formatPercent(this.margin().percent));
  protected readonly profitText = computed(
    () => `${formatRupees(this.margin().profitCents)} profit per ${this.unit()}`
  );
  protected readonly lossText = computed(
    () =>
      `You lose ${formatRupees(Math.abs(this.margin().profitCents))} on every ${this.unit()} sold.`
  );
  protected readonly barValue = computed(() =>
    Math.min(Math.max(this.margin().percent, 0), FULL_BAR)
  );
}
