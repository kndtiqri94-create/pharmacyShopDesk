import { Component, computed, input, signal } from '@angular/core';
import { DailySalesPoint } from '../../../../core/models/domain/sales-summary.model';
import { ChartBar, buildChartBars } from '../../../../core/utils/dashboard-metrics.util';
import { formatDate, formatDayOfMonth, formatWeekday } from '../../../../core/utils/date.util';
import { formatRupees, formatThousands } from '../../../../core/utils/money.util';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ChipItem } from '../../../../shared/components/chips/chip-item.model';
import { ChipsComponent } from '../../../../shared/components/chips/chips.component';

const WEEK = '7';
const MONTH = '30';
const AXIS_LABEL_INTERVAL = 5;

@Component({
  selector: 'app-dashboard-sales-chart',
  imports: [CardComponent, ChipsComponent],
  templateUrl: './dashboard-sales-chart.component.html',
  styleUrl: './dashboard-sales-chart.component.scss',
})
export class DashboardSalesChartComponent {
  readonly points = input.required<readonly DailySalesPoint[]>();
  readonly today = input.required<string>();

  protected readonly periodItems: readonly ChipItem[] = [
    { id: WEEK, label: '7 days' },
    { id: MONTH, label: '30 days' },
  ];
  protected readonly period = signal(WEEK);
  protected readonly days = computed(() =>
    this.period() === MONTH ? Number(MONTH) : Number(WEEK)
  );
  protected readonly title = computed(() => `Sales, last ${this.days()} days`);
  protected readonly bars = computed(() =>
    buildChartBars(this.points(), this.days(), this.today())
  );
  protected readonly formatThousands = formatThousands;

  protected axisLabel(bar: ChartBar, index: number): string {
    if (this.days() === Number(WEEK)) return formatWeekday(bar.date);
    const showLabel = bar.isToday || index % AXIS_LABEL_INTERVAL === 0;
    return showLabel ? formatDayOfMonth(bar.date) : '';
  }

  protected readableValue(bar: ChartBar): string {
    const suffix = bar.isToday ? ', today' : '';
    return `${formatDate(bar.date)}: ${formatRupees(bar.salesCents)}${suffix}`;
  }
}
