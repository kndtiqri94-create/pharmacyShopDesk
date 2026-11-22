import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CanWriteDirective } from '../../../../core/directives/permission-write.directive';
import { PurchaseOrder } from '../../../../core/models/domain/purchase-order.model';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { PoStatus } from '../../../../core/models/enums/po-status.enum';
import { ClockService } from '../../../../core/services/clock.service';
import { PurchaseOrderDataService } from '../../../../core/services/data/purchase-order-data.service';
import { SupplierDataService } from '../../../../core/services/data/supplier-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { formatDate, formatDayMonth } from '../../../../core/utils/date.util';
import {
  PoStatusFilter,
  PurchaseOrderListItem,
  SEARCH_MAX_LENGTH,
  countOverdueOrders,
  countPurchaseOrdersByStatus,
  filterPurchaseOrderItems,
  parsePoStatusFilter,
  recentRange,
  toPurchaseOrderListItems,
} from '../../../../core/utils/purchase-order-list-filter.util';
import { pluralize } from '../../../../core/utils/text.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ChipItem } from '../../../../shared/components/chips/chip-item.model';
import { ChipsComponent } from '../../../../shared/components/chips/chips.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PoStatusBadgeComponent } from '../po-status-badge/po-status-badge.component';

const STATUS_CHIPS: readonly { id: PoStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'part-received', label: 'Part received' },
  { id: 'received', label: 'Received' },
  { id: 'cancelled', label: 'Cancelled' },
];

const RECEIVABLE_STATUSES: readonly PoStatus[] = [PoStatus.SENT, PoStatus.PART_RECEIVED];

@Component({
  selector: 'app-purchase-order-list',
  imports: [
    AlertComponent,
    ButtonComponent,
    CanWriteDirective,
    CardComponent,
    ChipsComponent,
    DataTableCellDirective,
    DataTableComponent,
    IconComponent,
    PageHeaderComponent,
    PoStatusBadgeComponent,
  ],
  templateUrl: './purchase-order-list.component.html',
  styleUrl: './purchase-order-list.component.scss',
})
export class PurchaseOrderListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clockService = inject(ClockService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly purchaseOrderDataService = inject(PurchaseOrderDataService);
  private readonly supplierDataService = inject(SupplierDataService);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly moduleKey = ModuleKey.PURCHASE_ORDERS;
  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;
  protected readonly range = recentRange(this.clockService.today());
  protected readonly rangeText = `${formatDayMonth(this.range.from)} – ${formatDate(this.range.to)}`;
  protected readonly canWrite = computed(() => this.permissionService.canWrite(this.moduleKey));
  protected readonly canReceive = computed(() => this.permissionService.canWrite(ModuleKey.GRN));
  protected readonly search = signal('');
  protected readonly status = linkedSignal<PoStatusFilter>(() =>
    parsePoStatusFilter(this.queryParams().get('status'))
  );
  protected readonly page = linkedSignal({
    source: () => ({ search: this.search(), status: this.status() }),
    computation: () => 1,
  });

  private readonly data = toSignal(
    forkJoin({
      orders: this.purchaseOrderDataService.getAll(),
      suppliers: this.supplierDataService.getAll(),
    })
  );

  protected readonly items = computed<readonly PurchaseOrderListItem[]>(() => {
    const data = this.data();
    return data
      ? toPurchaseOrderListItems(data.orders, data.suppliers, this.clockService.today())
      : [];
  });
  protected readonly rows = computed(() =>
    filterPurchaseOrderItems(this.items(), {
      search: this.search(),
      status: this.status(),
      range: this.range,
    })
  );
  protected readonly chipItems = computed<readonly ChipItem[]>(() => {
    const counts = countPurchaseOrdersByStatus(this.items(), {
      search: this.search(),
      range: this.range,
    });
    return STATUS_CHIPS.map(chip => ({ ...chip, count: counts[chip.id] }));
  });
  protected readonly overdueMessage = computed(() => {
    const count = countOverdueOrders(this.items());
    return count > 0 ? `${pluralize(count, 'purchase order')} overdue` : null;
  });

  protected readonly columns: readonly DataTableColumn<PurchaseOrderListItem>[] = [
    { key: 'number', label: 'PO no', kind: 'code', value: item => item.order.number },
    { key: 'ordered', label: 'Ordered', value: item => formatDate(item.order.orderDate) },
    {
      key: 'supplier',
      label: 'Supplier',
      value: item => item.supplierName || 'No supplier yet',
      subValue: item => item.contactSummary,
    },
    { key: 'expected', label: 'Expected' },
    { key: 'items', label: 'Items', kind: 'number', value: item => item.itemCount },
    { key: 'total', label: 'Total', kind: 'money', value: item => item.order.totalCents },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ];
  protected readonly rowKey = (item: PurchaseOrderListItem): string => item.order.id;

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.slice(0, SEARCH_MAX_LENGTH));
  }

  protected setStatus(value: string): void {
    this.status.set(parsePoStatusFilter(value));
  }

  protected showSampleMessage(feature: string): void {
    this.notificationService.showSampleOnly(feature);
  }

  protected canReceiveOrder(order: PurchaseOrder): boolean {
    return this.canReceive() && RECEIVABLE_STATUSES.includes(order.status);
  }

  protected canEditOrder(order: PurchaseOrder): boolean {
    return this.canWrite() && order.status === PoStatus.DRAFT;
  }

  protected newOrder(): void {
    if (!this.canWrite()) return;
    this.router.navigate(['/purchase-orders', 'new']).catch(() => undefined);
  }

  protected receive(order: PurchaseOrder): void {
    if (!this.canReceiveOrder(order)) return;
    this.router.navigate(['/grn', 'new'], { queryParams: { po: order.id } }).catch(() => undefined);
  }

  protected edit(order: PurchaseOrder): void {
    if (!this.canEditOrder(order)) return;
    this.router.navigate(['/purchase-orders', order.id, 'edit']).catch(() => undefined);
  }

  protected view(order: PurchaseOrder): void {
    this.router.navigate(['/purchase-orders', order.id]).catch(() => undefined);
  }
}
