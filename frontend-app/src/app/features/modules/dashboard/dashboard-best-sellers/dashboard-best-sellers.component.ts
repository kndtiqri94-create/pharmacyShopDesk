import { Component, computed, input } from '@angular/core';
import { BestSeller } from '../../../../core/models/domain/sales-summary.model';
import { formatCount } from '../../../../core/utils/money.util';
import { pluralize } from '../../../../core/utils/text.util';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ProgressBarComponent } from '../../../../shared/components/progress-bar/progress-bar.component';

@Component({
  selector: 'app-dashboard-best-sellers',
  imports: [CardComponent, EmptyStateComponent, ProgressBarComponent],
  templateUrl: './dashboard-best-sellers.component.html',
  styleUrl: './dashboard-best-sellers.component.scss',
})
export class DashboardBestSellersComponent {
  readonly sellers = input.required<readonly BestSeller[]>();

  protected readonly topUnits = computed(() =>
    this.sellers().reduce((max, seller) => Math.max(max, seller.unitsSold), 1)
  );
  protected readonly formatCount = formatCount;

  protected unitsLabel(seller: BestSeller): string {
    return `${seller.productName}, ${pluralize(seller.unitsSold, 'unit')} sold`;
  }
}
