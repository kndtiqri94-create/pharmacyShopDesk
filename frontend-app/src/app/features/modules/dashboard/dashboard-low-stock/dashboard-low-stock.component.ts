import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { PermissionService } from '../../../../core/services/permission.service';
import { LowStockRow } from '../../../../core/utils/dashboard-metrics.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ProductStatusBadgeComponent } from '../../../../shared/components/product-status-badge/product-status-badge.component';

@Component({
  selector: 'app-dashboard-low-stock',
  imports: [
    ButtonComponent,
    CardComponent,
    DataTableCellDirective,
    DataTableComponent,
    ProductStatusBadgeComponent,
  ],
  templateUrl: './dashboard-low-stock.component.html',
  styleUrl: './dashboard-low-stock.component.scss',
})
export class DashboardLowStockComponent {
  readonly rows = input.required<readonly LowStockRow[]>();

  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);

  protected readonly columns: readonly DataTableColumn<LowStockRow>[] = [
    { key: 'name', label: 'Product' },
    { key: 'stock', label: 'In stock', kind: 'number' },
    { key: 'reorderLevel', label: 'Reorder at', kind: 'number' },
    { key: 'status', label: 'Status' },
  ];
  protected readonly rowKey = (row: LowStockRow): string => row.productId;

  protected canOpenProducts(): boolean {
    return this.permissionService.canView(ModuleKey.PRODUCTS);
  }

  protected viewAll(): void {
    this.router
      .navigate(['/products'], { queryParams: { status: 'low-stock' } })
      .catch(() => undefined);
  }
}
