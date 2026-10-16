import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { Grn } from '../../../../core/models/domain/grn.model';
import { Product } from '../../../../core/models/domain/product.model';
import { PurchaseOrder } from '../../../../core/models/domain/purchase-order.model';
import { Supplier } from '../../../../core/models/domain/supplier.model';
import { GrnStatus } from '../../../../core/models/enums/grn-status.enum';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { ClockService } from '../../../../core/services/clock.service';
import { GrnDataService } from '../../../../core/services/data/grn-data.service';
import { ProductDataService } from '../../../../core/services/data/product-data.service';
import { PurchaseOrderDataService } from '../../../../core/services/data/purchase-order-data.service';
import { SupplierDataService } from '../../../../core/services/data/supplier-data.service';
import { GrnDraftService } from '../../../../core/services/grn-draft.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { StockInResult, StockInService } from '../../../../core/services/stock-in.service';
import { formatDate, formatDayMonth } from '../../../../core/utils/date.util';
import { nextDocumentNumber } from '../../../../core/utils/document-number.util';
import { findExpiryWarnings } from '../../../../core/utils/expiry-warning.util';
import {
  emptyGrnInput,
  grnToInput,
  linesFromOrder,
  orderedQuantities,
} from '../../../../core/utils/grn-prefill.util';
import { computeGrnTotals, grnLineTotalCents } from '../../../../core/utils/grn-totals.util';
import {
  GrnFieldErrors,
  GrnFormInput,
  MAX_GRN_LINES,
  GRN_TEXT_MAX_LENGTH,
  isReceivableOrder,
} from '../../../../core/utils/grn-validation.util';
import { formatRupeesInput } from '../../../../core/utils/money.util';
import { parseCents, parseQuantity } from '../../../../core/utils/number-input.util';
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHOD_OPTIONS,
} from '../../../../core/utils/payment-method-display.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { BreadcrumbItem } from '../../../../shared/components/breadcrumb/breadcrumb-item.model';
import { BreadcrumbComponent } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ProductPickerComponent } from '../../../../shared/components/product-picker/product-picker.component';
import { GrnItemsTableComponent } from '../grn-items-table/grn-items-table.component';
import { GrnTotalsCardComponent } from '../grn-totals-card/grn-totals-card.component';
import { GrnLineGroup, createGrnLineGroup } from './grn-line-form';

export type GrnFormMode = 'create' | 'open';

const ID_PATTERN = /^[A-Za-z0-9-]{1,40}$/;
const FIELD_ID_PREFIX = 'grn-';

@Component({
  selector: 'app-grn-form',
  imports: [
    ...FIELD_IMPORTS,
    AlertComponent,
    BadgeComponent,
    BreadcrumbComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    GrnItemsTableComponent,
    GrnTotalsCardComponent,
    PageHeaderComponent,
    ProductPickerComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './grn-form.component.html',
  styleUrl: './grn-form.component.scss',
})
export class GrnFormComponent implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly authService = inject(AuthService);
  private readonly clockService = inject(ClockService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly grnDraftService = inject(GrnDraftService);
  private readonly stockInService = inject(StockInService);
  private readonly grnDataService = inject(GrnDataService);
  private readonly productDataService = inject(ProductDataService);
  private readonly purchaseOrderDataService = inject(PurchaseOrderDataService);
  private readonly supplierDataService = inject(SupplierDataService);

  protected readonly mode: GrnFormMode = this.route.snapshot.data['mode'] ?? 'create';
  protected readonly moduleKey = ModuleKey.GRN;
  protected readonly today = this.clockService.today();
  protected readonly maxLength = GRN_TEXT_MAX_LENGTH;
  protected readonly paymentOptions = PAYMENT_METHOD_OPTIONS;
  protected readonly paymentLabel = PAYMENT_METHOD_LABEL;

  protected readonly form = this.formBuilder.group({
    supplierId: '',
    purchaseOrderId: '',
    receivedDate: this.today,
    invoiceNo: '',
    invoiceDate: '',
    paymentMethod: 'CREDIT',
    paidNow: '',
    dueDate: '',
    discount: '',
    lines: new FormArray<GrnLineGroup>([]),
  });
  protected readonly values = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );

  protected readonly loaded = signal(false);
  protected readonly notFound = signal(false);
  protected readonly saving = signal(false);
  protected readonly addingItem = signal(false);
  protected readonly errors = signal<GrnFieldErrors>({});
  protected readonly existing = signal<Grn | null>(null);
  protected readonly products = signal<readonly Product[]>([]);
  protected readonly suppliers = signal<readonly Supplier[]>([]);
  protected readonly orders = signal<readonly PurchaseOrder[]>([]);
  protected readonly nextNumber = signal('');
  protected readonly ordered = signal<ReadonlyMap<string, number>>(new Map());

  protected readonly readOnly = computed(
    () =>
      this.existing()?.status === GrnStatus.RECEIVED ||
      this.existing()?.status === GrnStatus.CANCELLED ||
      !this.permissionService.canWrite(this.moduleKey)
  );
  protected readonly lines: FormArray<GrnLineGroup> = this.form.controls.lines;
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
  protected readonly orderOptions = computed(() => {
    const supplierId = this.values().supplierId;
    const chosen = this.values().purchaseOrderId;
    return this.orders().filter(
      order =>
        order.id === chosen ||
        (isReceivableOrder(order) && (supplierId === '' || order.supplierId === supplierId))
    );
  });
  protected readonly parsedLines = computed(() =>
    this.values().lines.map(line => ({
      receivedQuantity: parseQuantity(line.received) ?? 0,
      freeQuantity: parseQuantity(line.free) ?? 0,
      costCents: parseCents(line.cost) ?? 0,
    }))
  );
  protected readonly lineTotals = computed(() =>
    this.parsedLines().map(line => grnLineTotalCents(line))
  );
  protected readonly totals = computed(() =>
    computeGrnTotals(
      this.parsedLines(),
      parseCents(this.values().discount) ?? 0,
      parseCents(this.values().paidNow) ?? 0
    )
  );
  protected readonly warnings = computed(() =>
    findExpiryWarnings(
      this.values().lines.map(line => ({
        productName: this.productsById().get(line.productId)?.name ?? 'This item',
        expiry: line.expiry,
      })),
      this.today
    )
  );
  protected readonly shortDated = computed(
    () => new Set(this.warnings().map(warning => warning.lineIndex))
  );
  protected readonly receivedBy = computed(() => {
    const original = this.existing()?.receivedBy;
    return this.readOnly() && original
      ? original
      : (this.authService.currentUser()?.displayName ?? '');
  });
  protected readonly title = computed(() => {
    if (this.notFound()) return 'GRN not found';
    const grn = this.existing();
    return grn !== null && grn.status !== GrnStatus.DRAFT ? grn.number : 'New GRN';
  });
  protected readonly subtitle = computed(() => {
    if (this.notFound()) return 'We could not find that GRN.';
    const grn = this.existing();
    if (grn === null) return `${this.nextNumber()} · Draft saved automatically`;
    if (grn.status === GrnStatus.DRAFT) return `${grn.number} · Draft`;
    return `Received ${formatDate(grn.receivedDate)} · You can look at it but you cannot change it.`;
  });
  protected readonly breadcrumb = computed<readonly BreadcrumbItem[]>(() => [
    { label: 'GRN', link: '/grn' },
    { label: this.title() },
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

  protected orderLabel(order: PurchaseOrder): string {
    const supplier = this.suppliers().find(candidate => candidate.id === order.supplierId);
    return `${order.number} · ${supplier?.name ?? ''} · expected ${formatDayMonth(order.expectedDate)}`;
  }

  protected onSupplierChange(event: Event): void {
    const supplierId = (event.target as HTMLSelectElement).value;
    const order = this.orders().find(
      candidate => candidate.id === this.form.controls.purchaseOrderId.value
    );
    if (order && order.supplierId !== supplierId) this.clearOrderChoice();
  }

  protected onOrderChange(event: Event): void {
    const orderId = (event.target as HTMLSelectElement).value;
    const order = this.orders().find(candidate => candidate.id === orderId);
    if (order === undefined || !isReceivableOrder(order)) {
      this.clearOrderChoice();
      return;
    }
    this.fillFromOrder(order);
  }

  protected openItemPicker(): void {
    this.addingItem.set(true);
  }

  protected closeItemPicker(): void {
    this.addingItem.set(false);
  }

  protected addProduct(productId: string): void {
    const product = this.productsById().get(productId);
    if (!product) return;
    if (this.lines.length >= MAX_GRN_LINES) {
      this.notificationService.show(
        'warning',
        `You can receive up to ${MAX_GRN_LINES} items on one GRN.`
      );
      return;
    }
    this.lines.push(
      createGrnLineGroup({
        productId: product.id,
        batchNo: '',
        expiry: '',
        received: '',
        free: '0',
        cost: formatRupeesInput(product.costCents),
        price: formatRupeesInput(product.priceCents),
      })
    );
    this.form.markAsDirty();
    this.addingItem.set(false);
    const index = this.lines.length - 1;
    afterNextRender(() => this.focusField(`line-${index}-batchNo`), { injector: this.injector });
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
    this.errors.set({});
    this.form.markAsDirty();
  }

  protected scanItem(): void {
    this.notificationService.showSampleOnly('Scan item');
  }

  protected goToList(): void {
    this.router.navigate(['/grn']).catch(() => undefined);
  }

  protected saveDraft(): void {
    this.submit('draft').catch(() => undefined);
  }

  protected receiveStock(): void {
    this.submit('receive').catch(() => undefined);
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
    this.orders.set(orders);
    this.nextNumber.set(
      nextDocumentNumber(
        'GRN',
        grns.map(grn => grn.number)
      )
    );
    if (this.mode === 'create') {
      this.startNew(orders, products);
    } else if (!this.openExisting(grns, orders)) {
      this.notFound.set(true);
    }
    if (this.readOnly()) this.form.disable();
    this.watchForDraft();
    this.loaded.set(true);
  }

  private startNew(orders: readonly PurchaseOrder[], products: readonly Product[]): void {
    const requested = this.route.snapshot.queryParamMap.get('po');
    if (requested !== null) {
      const order = ID_PATTERN.test(requested)
        ? orders.find(candidate => candidate.id === requested)
        : undefined;
      if (order && isReceivableOrder(order)) {
        this.grnDraftService.clear();
        this.fillForm({
          ...emptyGrnInput(this.today),
          supplierId: order.supplierId,
          purchaseOrderId: order.id,
          lines: linesFromOrder(order, products),
        });
        this.ordered.set(orderedQuantities(order));
        return;
      }
      this.notificationService.show(
        'warning',
        'That purchase order cannot be received, so the GRN starts empty.'
      );
    }
    const kept = this.grnDraftService.restore();
    this.fillForm(kept ?? emptyGrnInput(this.today));
    this.ordered.set(
      orderedQuantities(orders.find(order => order.id === this.form.controls.purchaseOrderId.value))
    );
  }

  private openExisting(grns: readonly Grn[], orders: readonly PurchaseOrder[]): boolean {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const grn = ID_PATTERN.test(id) ? grns.find(candidate => candidate.id === id) : undefined;
    if (!grn) return false;
    this.existing.set(grn);
    this.fillForm(grnToInput(grn, orders));
    this.ordered.set(
      orderedQuantities(orders.find(order => order.number === grn.purchaseOrderNumber))
    );
    return true;
  }

  private fillForm(input: GrnFormInput): void {
    this.lines.clear();
    const { lines, ...header } = input;
    for (const line of lines) this.lines.push(createGrnLineGroup(line));
    this.form.patchValue(header);
    this.errors.set({});
  }

  private fillFromOrder(order: PurchaseOrder): void {
    this.form.controls.supplierId.setValue(order.supplierId);
    this.form.controls.purchaseOrderId.setValue(order.id);
    this.lines.clear();
    for (const line of linesFromOrder(order, this.products())) {
      this.lines.push(createGrnLineGroup(line));
    }
    this.ordered.set(orderedQuantities(order));
    this.errors.set({});
    this.form.markAsDirty();
  }

  private clearOrderChoice(): void {
    this.form.controls.purchaseOrderId.setValue('');
    this.ordered.set(new Map());
  }

  private watchForDraft(): void {
    if (this.mode !== 'create' || this.readOnly()) return;
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.grnDraftService.keep(this.form.getRawValue());
    });
  }

  private async submit(kind: 'draft' | 'receive'): Promise<void> {
    if (this.readOnly() || this.saving() || !this.permissionService.canWrite(this.moduleKey))
      return;
    this.saving.set(true);
    try {
      const input = this.form.getRawValue();
      const existingId = this.existing()?.id ?? null;
      const result =
        kind === 'receive'
          ? await this.stockInService.receiveGrn(input, existingId)
          : await this.stockInService.saveDraft(input, existingId);
      this.handleResult(result, kind);
    } catch {
      this.notificationService.show(
        'warning',
        'Something went wrong and the GRN was not completed. Check the stock before you try again.'
      );
    } finally {
      this.saving.set(false);
    }
  }

  private handleResult(result: StockInResult, kind: 'draft' | 'receive'): void {
    if (!result.ok) {
      this.showFailure(result);
      return;
    }
    this.errors.set({});
    this.grnDraftService.clear();
    this.form.markAsPristine();
    this.notificationService.show(
      'success',
      kind === 'receive'
        ? `${result.grn.number} received. Stock and cost prices are updated.`
        : `${result.grn.number} saved as a draft.`
    );
    this.goToList();
  }

  private showFailure(result: Extract<StockInResult, { ok: false }>): void {
    if (result.reason === 'invalid') {
      this.errors.set(result.errors);
      this.focusField(result.firstErrorField);
      return;
    }
    const messages = {
      denied: 'You do not have access to receive stock.',
      'not-found': 'We could not find that GRN.',
      'already-received': 'That GRN has already been received.',
    } as const;
    this.notificationService.show('warning', messages[result.reason]);
  }

  private focusField(key: string | null): void {
    if (key === null) return;
    this.hostElement.nativeElement.querySelector<HTMLElement>(`#${this.fieldId(key)}`)?.focus();
  }
}
