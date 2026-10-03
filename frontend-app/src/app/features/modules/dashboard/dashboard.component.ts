import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ClockService } from '../../../core/services/clock.service';
import { ProductDataService } from '../../../core/services/data/product-data.service';
import { PurchaseOrderDataService } from '../../../core/services/data/purchase-order-data.service';
import { ReloadDataService } from '../../../core/services/data/reload-data.service';
import { SalesDataService } from '../../../core/services/data/sales-data.service';
import { SettingsDataService } from '../../../core/services/data/settings-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import {
  buildNeedsAttention,
  computeStockAlertCounts,
  expireByDate,
  formatProfitMargin,
  formatSalesChange,
  MAX_CHART_DAYS,
  mostUrgentLowStock,
} from '../../../core/utils/dashboard-metrics.util';
import { formatDate, formatWeekdayLong } from '../../../core/utils/date.util';
import { formatRupees } from '../../../core/utils/money.util';
import { isPurchaseOrderOverdue } from '../../../core/utils/purchase-order-overdue.util';
import { pluralize } from '../../../core/utils/text.util';
import { getFirstName } from '../../../core/utils/user-name.util';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { DashboardBestSellersComponent } from './dashboard-best-sellers/dashboard-best-sellers.component';
import { DashboardLowStockComponent } from './dashboard-low-stock/dashboard-low-stock.component';
import { DashboardNeedsAttentionComponent } from './dashboard-needs-attention/dashboard-needs-attention.component';
import { DashboardSalesChartComponent } from './dashboard-sales-chart/dashboard-sales-chart.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    ButtonComponent,
    DashboardBestSellersComponent,
    DashboardLowStockComponent,
    DashboardNeedsAttentionComponent,
    DashboardSalesChartComponent,
    PageHeaderComponent,
    StatCardComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly clockService = inject(ClockService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly productDataService = inject(ProductDataService);
  private readonly purchaseOrderDataService = inject(PurchaseOrderDataService);
  private readonly reloadDataService = inject(ReloadDataService);
  private readonly salesDataService = inject(SalesDataService);
  private readonly settingsDataService = inject(SettingsDataService);

  protected readonly today = this.clockService.today();
  protected readonly canCreateGrn = computed(() => this.permissionService.canWrite(ModuleKey.GRN));
  protected readonly greeting = computed(() => {
    const user = this.authService.currentUser();
    return user ? `Good morning, ${getFirstName(user.displayName)}` : 'Good morning';
  });

  private readonly data = toSignal(
    forkJoin({
      products: this.productDataService.getAll(),
      settings: this.settingsDataService.get(),
      orders: this.purchaseOrderDataService.getAll(),
      floats: this.reloadDataService.getFloatHistory(),
      sales: this.salesDataService.getDailySales(MAX_CHART_DAYS),
      summary: this.salesDataService.getTodaySummary(),
      bestSellers: this.salesDataService.getBestSellers(),
    })
  );

  protected readonly view = computed(() => {
    const data = this.data();
    if (!data) return null;
    const { products, settings, orders, floats, summary } = data;
    const alertDays = settings.expiryAlertDays;
    const counts = computeStockAlertCounts(products, alertDays, this.today);
    const latestFloat = floats.reduce<(typeof floats)[number] | null>(
      (latest, entry) => (latest === null || entry.date > latest.date ? entry : latest),
      null
    );
    const attention = buildNeedsAttention({
      needsRestock: counts.needsRestock,
      expiringBatches: counts.expiringBatches,
      expireByDate: expireByDate(this.today, alertDays),
      overdueOrders: orders.filter(order => isPurchaseOrderOverdue(order, this.today)).length,
      floatLow: latestFloat !== null && latestFloat.availableCents < settings.lowFloatCents,
    });
    return {
      subtitle: `${formatDate(this.today)} · ${settings.branchLabel}`,
      salesValue: formatRupees(summary.salesCents),
      salesNote: `${formatSalesChange(summary.salesCents, summary.comparedSalesCents)} vs last ${formatWeekdayLong(summary.date)}`,
      profitValue: formatRupees(summary.profitCents),
      profitNote: `${formatProfitMargin(summary.profitCents, summary.salesCents)} margin on ${pluralize(summary.bills, 'bill')}`,
      lowStockValue: pluralize(counts.needsRestock, 'item'),
      lowStockNote: `below reorder level · ${counts.outOfStock} out of stock`,
      expiringValue: pluralize(counts.expiringBatches, 'batch', 'batches'),
      expiringNote: `within the next ${alertDays} days`,
      attention,
      lowStockRows: mostUrgentLowStock(products, alertDays, this.today),
      sales: data.sales,
      bestSellers: data.bestSellers,
    };
  });

  protected showDailyReportMessage(): void {
    this.notificationService.showSampleOnly('Daily report');
  }

  protected openNewGrn(): void {
    if (!this.canCreateGrn()) return;
    this.router.navigate(['/grn']).catch(() => undefined);
  }
}
