import { Component, computed, inject, input, output } from '@angular/core';
import { CanWriteDirective } from '../../../../core/directives/permission-write.directive';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { PermissionService } from '../../../../core/services/permission.service';
import { formatRupeesExact } from '../../../../core/utils/money.util';
import { getActiveDisplay } from '../../../../core/utils/status-display.util';
import { SupplierActivityItem } from '../../../../core/utils/supplier-activity.util';
import { SupplierListItem } from '../../../../core/utils/supplier-list-filter.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { SupplierActivityListComponent } from '../supplier-activity-list/supplier-activity-list.component';

@Component({
  selector: 'app-supplier-detail-panel',
  imports: [
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    CanWriteDirective,
    CardComponent,
    SupplierActivityListComponent,
  ],
  templateUrl: './supplier-detail-panel.component.html',
  styleUrl: './supplier-detail-panel.component.scss',
})
export class SupplierDetailPanelComponent {
  readonly item = input.required<SupplierListItem>();
  readonly activity = input.required<readonly SupplierActivityItem[]>();
  readonly recordPayment = output<void>();
  readonly edit = output<void>();
  readonly newOrder = output<void>();

  private readonly permissionService = inject(PermissionService);

  protected readonly suppliersModule = ModuleKey.SUPPLIERS;
  protected readonly supplier = computed(() => this.item().supplier);
  protected readonly status = computed(() => getActiveDisplay(this.supplier().active));
  protected readonly owedText = computed(() => formatRupeesExact(this.item().owedCents));
  protected readonly hasBalance = computed(() => this.item().owedCents > 0);
  protected readonly canOrder = computed(
    () => this.supplier().active && this.permissionService.canWrite(ModuleKey.PURCHASE_ORDERS)
  );
  protected readonly terms = computed(
    () => `${this.supplier().creditDays} days credit · delivers in ${this.supplier().deliveryDays}`
  );
}
