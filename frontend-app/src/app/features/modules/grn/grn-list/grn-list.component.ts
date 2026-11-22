import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CanWriteDirective } from '../../../../core/directives/permission-write.directive';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { ClockService } from '../../../../core/services/clock.service';
import { GrnDataService } from '../../../../core/services/data/grn-data.service';
import { PurchaseOrderDataService } from '../../../../core/services/data/purchase-order-data.service';
import { SupplierDataService } from '../../../../core/services/data/supplier-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatDate, formatDayMonth } from '../../../../core/utils/date.util';
import {
  GrnListItem,
  GrnStatusFilter,
  SEARCH_MAX_LENGTH,
  countGrnByStatus,
  filterGrnItems,
  monthRange,
  parseGrnStatusFilter,
  summarizeGrns,
  toGrnListItems,
} from '../../../../core/utils/grn-list-filter.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ChipItem } from '../../../../shared/components/chips/chip-item.model';
import { ChipsComponent } from '../../../../shared/components/chips/chips.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import {
  DataTableRowAction,
  DataTableRowActionEvent,
} from '../../../../shared/components/data-table/data-table-row-action.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { GrnStatusBadgeComponent } from '../grn-status-badge/grn-status-badge.component';
import { PaymentStatusBadgeComponent } from '../payment-status-badge/payment-status-badge.component';

const STATUS_CHIPS: readonly { id: GrnStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'received', label: 'Received' },
  { id: 'cancelled', label: 'Cancelled' },
];

const OPEN_ACTION: DataTableRowAction = { id: 'open', label: 'Open', icon: 'eye' };
const MORE_ACTION: DataTableRowAction = { id: 'more', label: 'More options for', icon: 'more' };

@Component({
  selector: 'app-grn-list',
  imports: [
    ButtonComponent,
    CanWriteDirective,
    CardComponent,
    ChipsComponent,
    DataTableCellDirective,
    DataTableComponent,
    GrnStatusBadgeComponent,
    IconComponent,
    PageHeaderComponent,
    PaymentStatusBadgeComponent,
    StatCardComponent,
  ],
  templateUrl: './grn-list.component.html',
  styleUrl: './grn-list.component.scss',
})
export class GrnListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clockService = inject(ClockService);
  private readonly notificationService = inject(NotificationService);
  private readonly grnDataService = inject(GrnDataService);
  private readonly purchaseOrderDataService = inject(PurchaseOrderDataService);
  private readonly supplierDataService = inject(SupplierDataService);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly moduleKey = ModuleKey.GRN;
  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;
  protected readonly actions: readonly DataTableRowAction[] = [OPEN_ACTION, MORE_ACTION];
  protected readonly range = monthRange(this.clockService.today());
  protected readonly rangeText = `${formatDayMonth(this.range.from)} – ${formatDate(this.range.to)}`;
  protected readonly search = signal('');
  protected readonly status = linkedSignal<GrnStatusFilter>(() =>
    parseGrnStatusFilter(this.queryParams().get('status'))
  );
  protected readonly page = linkedSignal({
    source: () => ({ search: this.search(), status: this.status() }),
    computation: () => 1,
  });

  private readonly data = toSignal(
    forkJoin({
      grns: this.grnDataService.getAll(),
      suppliers: this.supplierDataService.getAll(),
      orders: this.purchaseOrderDataService.getAll(),
    })
  );

  protected readonly items = computed<readonly GrnListItem[]>(() => {
    const data = this.data();
    return data ? toGrnListItems(data.grns, data.suppliers) : [];
  });
  protected readonly tiles = computed(() => {
    const data = this.data();
    return data ? summarizeGrns(data.grns, data.orders, this.clockService.today()) : null;
  });
  protected readonly rows = computed(() =>
    filterGrnItems(this.items(), {
      search: this.search(),
      status: this.status(),
      range: this.range,
    })
  );
  protected readonly chipItems = computed<readonly ChipItem[]>(() => {
    const counts = countGrnByStatus(this.items(), { search: this.search(), range: this.range });
    return STATUS_CHIPS.map(chip => ({ ...chip, count: counts[chip.id] }));
  });

  protected readonly columns: readonly DataTableColumn<GrnListItem>[] = [
    { key: 'number', label: 'GRN no', kind: 'code', value: item => item.grn.number },
    { key: 'received', label: 'Received', value: item => formatDate(item.grn.receivedDate) },
    {
      key: 'supplier',
      label: 'Supplier',
      value: item => item.supplierName || 'No supplier yet',
      subValue: item => `Received by ${item.grn.receivedBy}`,
    },
    { key: 'reference', label: 'Invoice · PO', value: item => item.reference },
    { key: 'items', label: 'Items', kind: 'number', value: item => item.itemCount },
    { key: 'total', label: 'Total', kind: 'money', value: item => item.grn.totalCents },
    { key: 'payment', label: 'Payment' },
    { key: 'status', label: 'Status' },
  ];
  protected readonly rowKey = (item: GrnListItem): string => item.grn.id;

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.slice(0, SEARCH_MAX_LENGTH));
  }

  protected setStatus(value: string): void {
    this.status.set(parseGrnStatusFilter(value));
  }

  protected showSampleMessage(feature: string): void {
    this.notificationService.showSampleOnly(feature);
  }

  protected newGrn(): void {
    this.router.navigate(['/grn', 'new']).catch(() => undefined);
  }

  protected onAction(event: DataTableRowActionEvent<GrnListItem>): void {
    if (event.actionId === 'open') {
      this.router.navigate(['/grn', event.row.grn.id]).catch(() => undefined);
    } else if (event.actionId === 'more') {
      this.showSampleMessage('More actions');
    }
  }
}
