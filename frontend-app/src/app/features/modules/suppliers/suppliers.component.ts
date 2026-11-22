import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CanWriteDirective } from '../../../core/directives/permission-write.directive';
import { Grn } from '../../../core/models/domain/grn.model';
import { PurchaseOrder } from '../../../core/models/domain/purchase-order.model';
import { Supplier } from '../../../core/models/domain/supplier.model';
import { SupplierPayment } from '../../../core/models/domain/supplier-payment.model';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { ClockService } from '../../../core/services/clock.service';
import { GrnDataService } from '../../../core/services/data/grn-data.service';
import { PurchaseOrderDataService } from '../../../core/services/data/purchase-order-data.service';
import { SupplierDataService } from '../../../core/services/data/supplier-data.service';
import { SupplierPaymentDataService } from '../../../core/services/data/supplier-payment-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  SupplierPaymentFailure,
  SupplierPaymentService,
} from '../../../core/services/supplier-payment.service';
import { formatRupeesExact } from '../../../core/utils/money.util';
import { buildSupplierActivity } from '../../../core/utils/supplier-activity.util';
import {
  formatSupplierSubtitle,
  summarizeSuppliers,
  toSupplierListItems,
} from '../../../core/utils/supplier-list-filter.util';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { RecordPaymentDialogComponent } from './record-payment-dialog/record-payment-dialog.component';
import { SupplierDetailPanelComponent } from './supplier-detail-panel/supplier-detail-panel.component';
import { SupplierListComponent } from './supplier-list/supplier-list.component';

interface SupplierPageData {
  suppliers: readonly Supplier[];
  grns: readonly Grn[];
  orders: readonly PurchaseOrder[];
  payments: readonly SupplierPayment[];
}

const PAYMENT_FAILURE_MESSAGES: Record<SupplierPaymentFailure, string> = {
  denied: 'You do not have access to record supplier payments.',
  busy: 'A payment is already being recorded. Wait a moment and check the figures.',
  'not-found': 'We could not find that supplier. Choose a supplier from the list.',
  'nothing-owed': 'You do not owe this supplier anything, so there is nothing to pay.',
  'invalid-amount': 'Enter an amount above zero.',
  'too-much': 'The amount is more than you owe this supplier. Check the amount and try again.',
};

@Component({
  selector: 'app-suppliers',
  imports: [
    ButtonComponent,
    CanWriteDirective,
    PageHeaderComponent,
    RecordPaymentDialogComponent,
    SupplierDetailPanelComponent,
    SupplierListComponent,
  ],
  templateUrl: './suppliers.component.html',
  styleUrl: './suppliers.component.scss',
})
export class SuppliersComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clockService = inject(ClockService);
  private readonly notificationService = inject(NotificationService);
  private readonly supplierPaymentService = inject(SupplierPaymentService);
  private readonly supplierDataService = inject(SupplierDataService);
  private readonly grnDataService = inject(GrnDataService);
  private readonly purchaseOrderDataService = inject(PurchaseOrderDataService);
  private readonly supplierPaymentDataService = inject(SupplierPaymentDataService);

  protected readonly moduleKey = ModuleKey.SUPPLIERS;
  protected readonly paymentOpen = signal(false);
  protected readonly paymentBusy = signal(false);
  protected readonly paymentError = signal<string | null>(null);

  private readonly data = signal<SupplierPageData | null>(null);
  private readonly selectedId = signal<string | null>(null);

  protected readonly items = computed(() => {
    const data = this.data();
    return data ? toSupplierListItems(data.suppliers, data.grns, data.orders) : [];
  });
  protected readonly selectedItem = computed(() => {
    const items = this.items();
    return items.find(item => item.supplier.id === this.selectedId()) ?? items[0] ?? null;
  });
  protected readonly selectedKey = computed(() => this.selectedItem()?.supplier.id ?? null);
  protected readonly activity = computed(() => {
    const data = this.data();
    const selected = this.selectedItem();
    if (data === null || selected === null) return [];
    return buildSupplierActivity(selected.supplier.id, data, this.clockService.today());
  });
  protected readonly subtitle = computed(() =>
    formatSupplierSubtitle(summarizeSuppliers(this.items()))
  );

  ngOnInit(): void {
    this.load()
      .then(() => this.selectRequestedSupplier())
      .catch(() => undefined);
  }

  protected select(supplierId: string): void {
    this.selectedId.set(supplierId);
  }

  protected showSampleMessage(feature: string): void {
    this.notificationService.showSampleOnly(feature);
  }

  protected newOrder(): void {
    const supplier = this.selectedItem()?.supplier;
    if (!supplier?.active) return;
    this.router
      .navigate(['/purchase-orders', 'new'], { queryParams: { supplier: supplier.id } })
      .catch(() => undefined);
  }

  protected openPayment(): void {
    this.paymentError.set(null);
    this.paymentOpen.set(true);
  }

  protected closePayment(): void {
    if (this.paymentBusy()) return;
    this.paymentOpen.set(false);
    this.paymentError.set(null);
  }

  protected recordPayment(amountCents: number): void {
    this.submitPayment(amountCents).catch(() => {
      this.paymentBusy.set(false);
      this.paymentError.set('Something went wrong and the payment was not recorded. Try again.');
    });
  }

  private async submitPayment(amountCents: number): Promise<void> {
    const selected = this.selectedItem();
    if (selected === null || this.paymentBusy()) return;
    this.paymentBusy.set(true);
    this.paymentError.set(null);
    const result = await this.supplierPaymentService.recordPayment(
      selected.supplier.id,
      amountCents
    );
    if (result.ok) {
      this.paymentOpen.set(false);
      this.notificationService.show(
        'success',
        `Payment of ${formatRupeesExact(result.payment.amountCents)} recorded for ${selected.supplier.name}.`
      );
    } else {
      this.paymentError.set(PAYMENT_FAILURE_MESSAGES[result.reason]);
    }
    await this.load();
    this.paymentBusy.set(false);
  }

  private async load(): Promise<void> {
    const [suppliers, grns, orders, payments] = await Promise.all([
      firstValueFrom(this.supplierDataService.getAll()),
      firstValueFrom(this.grnDataService.getAll()),
      firstValueFrom(this.purchaseOrderDataService.getAll()),
      firstValueFrom(this.supplierPaymentDataService.getAll()),
    ]);
    this.data.set({ suppliers, grns, orders, payments });
  }

  private selectRequestedSupplier(): void {
    const requested = this.route.snapshot.queryParamMap.get('supplier');
    if (requested !== null && this.items().some(item => item.supplier.id === requested)) {
      this.selectedId.set(requested);
    }
  }
}
