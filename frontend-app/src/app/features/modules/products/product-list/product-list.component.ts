import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CanWriteDirective } from '../../../../core/directives/permission-write.directive';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { ClockService } from '../../../../core/services/clock.service';
import { ProductDataService } from '../../../../core/services/data/product-data.service';
import { SettingsDataService } from '../../../../core/services/data/settings-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { formatCount } from '../../../../core/utils/money.util';
import {
  formatBatchExpiry,
  formatProductDetails,
} from '../../../../core/utils/product-display.util';
import {
  ALL_CATEGORIES,
  ProductListItem,
  SEARCH_MAX_LENGTH,
  StatusFilter,
  countByStatus,
  filterItems,
  listCategories,
  parseStatusFilter,
  summarizeList,
  toListItems,
} from '../../../../core/utils/product-list-filter.util';
import { getActiveDisplay } from '../../../../core/utils/status-display.util';
import { pluralize } from '../../../../core/utils/text.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
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
import { ProductStatusBadgeComponent } from '../../../../shared/components/product-status-badge/product-status-badge.component';

const STATUS_CHIPS: readonly { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in-stock', label: 'In stock' },
  { id: 'low-stock', label: 'Low stock' },
  { id: 'out-of-stock', label: 'Out of stock' },
  { id: 'expiring-soon', label: 'Expiring soon' },
];

const VIEW_ACTION: DataTableRowAction = { id: 'view', label: 'View', icon: 'eye' };
const EDIT_ACTION: DataTableRowAction = { id: 'edit', label: 'Edit', icon: 'edit' };
const MORE_ACTION: DataTableRowAction = { id: 'more', label: 'More options for', icon: 'more' };

@Component({
  selector: 'app-product-list',
  imports: [
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    CanWriteDirective,
    CardComponent,
    ChipsComponent,
    DataTableCellDirective,
    DataTableComponent,
    IconComponent,
    PageHeaderComponent,
    ProductStatusBadgeComponent,
  ],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clockService = inject(ClockService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly productDataService = inject(ProductDataService);
  private readonly settingsDataService = inject(SettingsDataService);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly moduleKey = ModuleKey.PRODUCTS;
  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;
  protected readonly allCategories = ALL_CATEGORIES;
  protected readonly canWrite = computed(() => this.permissionService.canWrite(this.moduleKey));
  protected readonly search = signal('');
  protected readonly category = signal(ALL_CATEGORIES);
  protected readonly status = linkedSignal<StatusFilter>(() =>
    parseStatusFilter(this.queryParams().get('status'))
  );
  protected readonly page = linkedSignal({
    source: () => ({ search: this.search(), category: this.category(), status: this.status() }),
    computation: () => 1,
  });
  protected readonly selectedKeys = signal<readonly (string | number)[]>([]);

  private readonly data = toSignal(
    forkJoin({
      products: this.productDataService.getAll(),
      settings: this.settingsDataService.get(),
    })
  );

  protected readonly items = computed<readonly ProductListItem[]>(() => {
    const data = this.data();
    return data
      ? toListItems(data.products, data.settings.expiryAlertDays, this.clockService.today())
      : [];
  });
  protected readonly categories = computed(() =>
    listCategories(this.items().map(item => item.product))
  );
  protected readonly rows = computed(() =>
    filterItems(this.items(), {
      search: this.search(),
      category: this.category(),
      status: this.status(),
    })
  );
  protected readonly chipItems = computed<readonly ChipItem[]>(() => {
    const counts = countByStatus(this.items(), {
      search: this.search(),
      category: this.category(),
    });
    return STATUS_CHIPS.map(chip => ({ ...chip, count: counts[chip.id] }));
  });
  protected readonly subtitle = computed(() => {
    const summary = summarizeList(this.items());
    return `${pluralize(summary.total, 'product')} · ${formatCount(summary.needsRestock)} low stock · ${formatCount(summary.expiringSoon)} expiring soon`;
  });
  protected readonly actions = computed<readonly DataTableRowAction[]>(() =>
    this.canWrite() ? [VIEW_ACTION, EDIT_ACTION, MORE_ACTION] : [VIEW_ACTION, MORE_ACTION]
  );

  protected readonly columns: readonly DataTableColumn<ProductListItem>[] = [
    {
      key: 'name',
      label: 'Product',
      value: item => item.product.name,
      subValue: item => this.details(item),
    },
    { key: 'sku', label: 'SKU', kind: 'code', value: item => item.product.sku },
    { key: 'batch', label: 'Batch · Expiry', value: item => formatBatchExpiry(item.product) },
    {
      key: 'stock',
      label: 'Stock',
      kind: 'number',
      value: item => item.stock,
      subValue: item => `min ${formatCount(item.product.reorderLevel)}`,
    },
    { key: 'cost', label: 'Cost', kind: 'money', value: item => item.product.costCents },
    { key: 'price', label: 'Price', kind: 'money', value: item => item.product.priceCents },
    { key: 'status', label: 'Status' },
  ];
  protected readonly rowKey = (item: ProductListItem): string => item.product.id;
  protected readonly inactiveDisplay = getActiveDisplay(false);

  protected details(item: ProductListItem): string {
    return formatProductDetails(item.product);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.slice(0, SEARCH_MAX_LENGTH));
  }

  protected onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.category.set(this.categories().includes(value) ? value : ALL_CATEGORIES);
  }

  protected setStatus(value: string): void {
    this.status.set(parseStatusFilter(value));
  }

  protected showSampleMessage(feature: string): void {
    this.notificationService.showSampleOnly(feature);
  }

  protected addProduct(): void {
    if (!this.canWrite()) return;
    this.router.navigate(['/products', 'new']).catch(() => undefined);
  }

  protected onAction(event: DataTableRowActionEvent<ProductListItem>): void {
    const id = event.row.product.id;
    if (event.actionId === 'view') {
      this.router.navigate(['/products', id]).catch(() => undefined);
    } else if (event.actionId === 'edit' && this.canWrite()) {
      this.router.navigate(['/products', id, 'edit']).catch(() => undefined);
    } else if (event.actionId === 'more') {
      this.showSampleMessage('More actions');
    }
  }
}
