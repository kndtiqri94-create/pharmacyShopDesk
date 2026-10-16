import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { Grn } from '../../../../core/models/domain/grn.model';
import { Product } from '../../../../core/models/domain/product.model';
import { PurchaseOrder } from '../../../../core/models/domain/purchase-order.model';
import { Supplier } from '../../../../core/models/domain/supplier.model';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { PoStatus } from '../../../../core/models/enums/po-status.enum';
import { ClockService } from '../../../../core/services/clock.service';
import { GrnDataService } from '../../../../core/services/data/grn-data.service';
import { ProductDataService } from '../../../../core/services/data/product-data.service';
import { PurchaseOrderDataService } from '../../../../core/services/data/purchase-order-data.service';
import { SupplierDataService } from '../../../../core/services/data/supplier-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { nextDocumentNumber, nextRecordId } from '../../../../core/utils/document-number.util';
import { MAX_GRN_LINES } from '../../../../core/utils/grn-validation.util';
import { formatRupeesInput } from '../../../../core/utils/money.util';
import { parseCents, parseQuantity } from '../../../../core/utils/number-input.util';
import {
  PurchaseOrderFieldErrors,
  PurchaseOrderFormInput,
  PURCHASE_ORDER_NOTES_MAX_LENGTH,
  ValidatedPurchaseOrder,
  validatePurchaseOrder,
} from '../../../../core/utils/purchase-order-validation.util';
import {
  computePurchaseOrderTotals,
  purchaseOrderLineTotalCents,
  suggestLowStockLines,
} from '../../../../core/utils/purchase-order-totals.util';
import { PO_STATUS_DISPLAY } from '../../../../core/utils/status-display.util';
import { amountOwedToSupplier } from '../../../../core/utils/supplier-owed.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { BreadcrumbItem } from '../../../../shared/components/breadcrumb/breadcrumb-item.model';
import { BreadcrumbComponent } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ProductPickerComponent } from '../../../../shared/components/product-picker/product-picker.component';
import { PoItemsTableComponent } from '../po-items-table/po-items-table.component';
import { PoTotalsCardComponent } from '../po-totals-card/po-totals-card.component';
import { SupplierSideCardComponent } from '../supplier-side-card/supplier-side-card.component';
import { PurchaseOrderLineGroup, createPurchaseOrderLineGroup } from './purchase-order-line-form';

export type PurchaseOrderFormMode = 'create' | 'edit' | 'view';

const ID_PATTERN = /^[A-Za-z0-9-]{1,40}$/;
const FIELD_ID_PREFIX = 'po-';

@Component({
  selector: 'app-purchase-order-form',
  imports: [
    ...FIELD_IMPORTS,
    BadgeComponent,
    BreadcrumbComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    PoItemsTableComponent,
    PoTotalsCardComponent,
    ProductPickerComponent,
    ReactiveFormsModule,
    SupplierSideCardComponent,
  ],
  templateUrl: './purchase-order-form.component.html',
  styleUrl: './purchase-order-form.component.scss',
})
export class PurchaseOrderFormComponent implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly clockService = inject(ClockService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly grnDataService = inject(GrnDataService);
  private readonly productDataService = inject(ProductDataService);
  private readonly purchaseOrderDataService = inject(PurchaseOrderDataService);
  private readonly supplierDataService = inject(SupplierDataService);

  protected readonly mode: PurchaseOrderFormMode = this.route.snapshot.data['mode'] ?? 'create';
  protected readonly moduleKey = ModuleKey.PURCHASE_ORDERS;
  protected readonly today = this.clockService.today();
  protected readonly notesMaxLength = PURCHASE_ORDER_NOTES_MAX_LENGTH;

  protected readonly form = this.formBuilder.group({
    supplierId: '',
    orderDate: this.today,
    expectedDate: '',
    notes: '',
    delivery: '',
    lines: new FormArray<PurchaseOrderLineGroup>([]),
  });
  protected readonly values = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );

  protected readonly loaded = signal(false);
  protected readonly notFound = signal(false);
  protected readonly saving = signal(false);
  protected readonly addingItem = signal(false);
  protected readonly errors = signal<PurchaseOrderFieldErrors>({});
  protected readonly existing = signal<PurchaseOrder | null>(null);
  protected readonly products = signal<readonly Product[]>([]);
  protected readonly suppliers = signal<readonly Supplier[]>([]);
  protected readonly grns = signal<readonly Grn[]>([]);
  protected readonly nextNumber = signal('');

  protected readonly lines: FormArray<PurchaseOrderLineGroup> = this.form.controls.lines;
  protected readonly readOnly = computed(
    () => this.mode === 'view' || !this.permissionService.canWrite(this.moduleKey)
  );
  protected readonly productsById = computed(
    () => new Map(this.products().map(product => [product.id, product]))
  );
  protected readonly pickerProducts = computed(() =>
    this.products()
      .filter(product => product.active)
      .sort((first, second) => first.name.localeCompare(second.name))
  );
  protected readonly supplierOptions = computed(() => {
    const current = this.values().supplierId;
    return this.suppliers().filter(supplier => supplier.active || supplier.id === current);
  });
  protected readonly chosenSupplier = computed(
    () => this.suppliers().find(supplier => supplier.id === this.values().supplierId) ?? null
  );
  protected readonly owedCents = computed(() =>
    amountOwedToSupplier(this.grns(), this.values().supplierId)
  );
  protected readonly parsedLines = computed(() =>
    this.values().lines.map(line => ({
      quantity: parseQuantity(line.quantity) ?? 0,
      unitCostCents: parseCents(line.unitCost) ?? 0,
    }))
  );
  protected readonly lineTotals = computed(() =>
    this.parsedLines().map(line => purchaseOrderLineTotalCents(line))
  );
  protected readonly totals = computed(() =>
    computePurchaseOrderTotals(this.parsedLines(), parseCents(this.values().delivery) ?? 0)
  );
  protected readonly statusLabel = computed(() => {
    const status = this.existing()?.status ?? PoStatus.DRAFT;
    return PO_STATUS_DISPLAY[status].label;
  });
  protected readonly number = computed(() => this.existing()?.number ?? this.nextNumber());
  protected readonly title = computed(() => {
    if (this.notFound()) return 'Purchase order not found';
    if (this.mode === 'create') return 'New purchase order';
    return this.mode === 'edit' ? 'Edit purchase order' : this.number();
  });
  protected readonly subtitle = computed(() => {
    if (this.notFound()) return 'We could not find that purchase order.';
    return `${this.number()} · ${this.statusLabel()}`;
  });
  protected readonly breadcrumb = computed<readonly BreadcrumbItem[]>(() => [
    { label: 'Purchase orders', link: '/purchase-orders' },
    { label: this.mode === 'create' ? 'New purchase order' : this.number() },
  ]);
  protected readonly lineError = computed(() => this.errors()['lines'] ?? null);

  ngOnInit(): void {
    this.initialize().catch(() => undefined);
  }

  protected fieldId(key: string): string {
    return `${FIELD_ID_PREFIX}${key}`;
  }

  protected error(key: string): string | null {
    return this.errors()[key] ?? null;
  }

  protected openItemPicker(): void {
    this.addingItem.set(true);
  }

  protected closeItemPicker(): void {
    this.addingItem.set(false);
  }

  protected addProduct(productId: string): void {
    const product = this.productsById().get(productId);
    if (!product || !this.canAddLines(1)) return;
    this.pushLine(product, '');
    this.addingItem.set(false);
    const index = this.lines.length - 1;
    afterNextRender(() => this.focusField(`line-${index}-quantity`), { injector: this.injector });
  }

  protected addLowStockItems(): void {
    const existingIds = this.values().lines.map(line => line.productId);
    const suggestions = suggestLowStockLines(this.products(), existingIds);
    if (suggestions.length === 0) {
      this.notificationService.show(
        'info',
        'No product is at or below its reorder level, or they are all on this order already.'
      );
      return;
    }
    if (!this.canAddLines(suggestions.length)) return;
    for (const suggestion of suggestions) {
      const product = this.productsById().get(suggestion.productId);
      if (product) this.pushLine(product, String(suggestion.quantity));
    }
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
    this.errors.set({});
    this.form.markAsDirty();
  }

  protected print(): void {
    this.notificationService.showSampleOnly('Print');
  }

  protected goToList(): void {
    this.router.navigate(['/purchase-orders']).catch(() => undefined);
  }

  protected saveDraft(): void {
    this.submit(PoStatus.DRAFT).catch(() => undefined);
  }

  protected markAsSent(): void {
    this.submit(PoStatus.SENT).catch(() => undefined);
  }

  private canAddLines(count: number): boolean {
    if (this.lines.length + count <= MAX_GRN_LINES) return true;
    this.notificationService.show(
      'warning',
      `You can order up to ${MAX_GRN_LINES} items on one purchase order.`
    );
    return false;
  }

  private pushLine(product: Product, quantity: string): void {
    this.lines.push(
      createPurchaseOrderLineGroup({
        productId: product.id,
        quantity,
        unitCost: formatRupeesInput(product.costCents),
      })
    );
    this.form.markAsDirty();
  }

  private async initialize(): Promise<void> {
    const [products, suppliers, orders, grns] = await Promise.all([
      firstValueFrom(this.productDataService.getAll()),
      firstValueFrom(this.supplierDataService.getAll()),
      firstValueFrom(this.purchaseOrderDataService.getAll()),
      firstValueFrom(this.grnDataService.getAll()),
    ]);
    this.products.set(products);
    this.suppliers.set(suppliers);
    this.grns.set(grns);
    this.nextNumber.set(
      nextDocumentNumber(
        'PO',
        orders.map(order => order.number)
      )
    );
    if (this.mode !== 'create' && !(await this.openExisting(orders))) {
      this.notFound.set(true);
    }
    if (this.readOnly()) this.form.disable();
    this.loaded.set(true);
  }

  private async openExisting(orders: readonly PurchaseOrder[]): Promise<boolean> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const order = ID_PATTERN.test(id) ? orders.find(candidate => candidate.id === id) : undefined;
    if (!order) return false;
    if (this.mode === 'edit' && order.status !== PoStatus.DRAFT) {
      await this.router.navigate(['/purchase-orders', order.id], { replaceUrl: true });
      return true;
    }
    this.existing.set(order);
    for (const line of order.lines) {
      this.lines.push(
        createPurchaseOrderLineGroup({
          productId: line.productId,
          quantity: String(line.orderedQuantity),
          unitCost: formatRupeesInput(line.unitCostCents),
        })
      );
    }
    this.form.patchValue({
      supplierId: order.supplierId,
      orderDate: order.orderDate,
      expectedDate: order.expectedDate,
      notes: order.notes,
      delivery: order.deliveryCents > 0 ? formatRupeesInput(order.deliveryCents) : '',
    });
    return true;
  }

  private async submit(status: PoStatus): Promise<void> {
    if (this.readOnly() || this.saving() || !this.permissionService.canWrite(this.moduleKey))
      return;
    this.saving.set(true);
    try {
      const input: PurchaseOrderFormInput = this.form.getRawValue();
      const result = validatePurchaseOrder(input, {
        products: this.products(),
        suppliers: this.suppliers(),
        strict: status === PoStatus.SENT,
      });
      this.errors.set(result.errors);
      if (result.values === null) {
        this.focusField(result.firstErrorField);
        return;
      }
      await this.store(result.values, status);
    } catch {
      this.notificationService.show(
        'warning',
        'Something went wrong and the purchase order was not saved. Try again.'
      );
    } finally {
      this.saving.set(false);
    }
  }

  private async store(values: ValidatedPurchaseOrder, status: PoStatus): Promise<void> {
    const orders = await firstValueFrom(this.purchaseOrderDataService.getAll());
    const original = this.existing();
    const order: PurchaseOrder = {
      ...values,
      id:
        original?.id ??
        nextRecordId(
          'po',
          orders.map(item => item.id)
        ),
      number:
        original?.number ??
        nextDocumentNumber(
          'PO',
          orders.map(item => item.number)
        ),
      status,
    };
    const saved = await firstValueFrom(this.purchaseOrderDataService.save(order));
    this.form.markAsPristine();
    this.notificationService.show(
      'success',
      status === PoStatus.SENT
        ? `${saved.number} marked as sent.`
        : `${saved.number} saved as a draft.`
    );
    this.goToList();
  }

  private focusField(key: string | null): void {
    if (key === null) return;
    this.hostElement.nativeElement.querySelector<HTMLElement>(`#${this.fieldId(key)}`)?.focus();
  }
}
