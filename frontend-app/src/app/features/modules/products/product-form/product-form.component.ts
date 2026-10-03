import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { Product } from '../../../../core/models/domain/product.model';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { DuplicateSkuError } from '../../../../core/services/data/duplicate-sku.error';
import { ProductDataService } from '../../../../core/services/data/product-data.service';
import { SettingsDataService } from '../../../../core/services/data/settings-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { computeMargin } from '../../../../core/utils/margin.util';
import { formatRupeesInput, rupeesToCents } from '../../../../core/utils/money.util';
import { listCategories } from '../../../../core/utils/product-list-filter.util';
import { formatUnitPlural } from '../../../../core/utils/product-display.util';
import {
  FIELD_MAX_LENGTH,
  PRODUCT_UNITS,
  ProductFieldErrors,
  ProductFieldKey,
  ProductFormInput,
  TAX_RATE_OPTIONS,
  ValidatedProductValues,
  parseNonNegativeNumber,
  validateProduct,
} from '../../../../core/utils/product-validation.util';
import { getStockOnHand } from '../../../../core/utils/stock-status.util';
import { capitalize } from '../../../../core/utils/text.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { BreadcrumbComponent } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { BreadcrumbItem } from '../../../../shared/components/breadcrumb/breadcrumb-item.model';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { MarginCardComponent } from '../margin-card/margin-card.component';
import { ProductStatusCardComponent } from '../product-status-card/product-status-card.component';

export type ProductFormMode = 'create' | 'edit' | 'view';
type ToggleKey = 'trackBatches' | 'prescriptionRequired' | 'active' | 'showInPosQuickList';

const ID_PATTERN = /^[A-Za-z0-9-]{1,40}$/;
const FIELD_ID_PREFIX = 'product-';

@Component({
  selector: 'app-product-form',
  imports: [
    ...FIELD_IMPORTS,
    AlertComponent,
    BadgeComponent,
    BreadcrumbComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    MarginCardComponent,
    PageHeaderComponent,
    ProductStatusCardComponent,
    ReactiveFormsModule,
    ToggleComponent,
  ],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
})
export class ProductFormComponent implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly productDataService = inject(ProductDataService);
  private readonly settingsDataService = inject(SettingsDataService);
  private defaultReorderLevel = 0;

  protected readonly mode: ProductFormMode = this.route.snapshot.data['mode'] ?? 'create';
  protected readonly moduleKey = ModuleKey.PRODUCTS;
  protected readonly units = PRODUCT_UNITS;
  protected readonly taxRates = TAX_RATE_OPTIONS;
  protected readonly maxLength = FIELD_MAX_LENGTH;
  protected readonly fieldIdPrefix = FIELD_ID_PREFIX;

  protected readonly form = this.formBuilder.group({
    name: '',
    unit: 'tablet',
    genericName: '',
    category: '',
    manufacturer: '',
    sku: '',
    barcode: '',
    costPrice: '',
    sellingPrice: '',
    taxRate: '0',
    reorderLevel: '',
    openingStock: '0',
    shelfLocation: '',
    trackBatches: true,
    prescriptionRequired: false,
    active: true,
    showInPosQuickList: true,
  });
  protected readonly values = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );

  protected readonly loaded = signal(false);
  protected readonly notFound = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirmingCancel = signal(false);
  protected readonly errors = signal<ProductFieldErrors>({});
  protected readonly product = signal<Product | null>(null);
  protected readonly categories = signal<readonly string[]>([]);
  private readonly allProducts = signal<readonly Product[]>([]);

  protected readonly readOnly = computed(
    () => this.mode === 'view' || !this.permissionService.canWrite(this.moduleKey)
  );
  protected readonly hasBatches = computed(() => (this.product()?.batches.length ?? 0) > 0);
  protected readonly unitPlural = computed(() => formatUnitPlural(this.values().unit));
  protected readonly margin = computed(() => {
    const { costPrice, sellingPrice } = this.values();
    const cost = parseNonNegativeNumber(costPrice, 2);
    const price = parseNonNegativeNumber(sellingPrice, 2);
    return computeMargin(rupeesToCents(cost ?? 0), rupeesToCents(price ?? 0));
  });
  protected readonly title = computed(() => {
    const name = this.product()?.name ?? '';
    if (this.notFound()) return 'Product not found';
    if (this.mode === 'create') return 'Add product';
    return this.mode === 'edit' ? `Edit ${name}` : name;
  });
  protected readonly subtitle = computed(() => {
    if (this.notFound()) return 'We could not find that product.';
    if (this.mode === 'create')
      return 'Fill in what you know now; batches and expiry come in through GRN.';
    return this.readOnly()
      ? 'You can look at this product but you cannot change it.'
      : 'Change what you need; batches and expiry come in through GRN.';
  });
  protected readonly breadcrumb = computed<readonly BreadcrumbItem[]>(() => [
    { label: 'Products', link: '/products' },
    { label: this.mode === 'create' ? 'Add product' : (this.product()?.name ?? 'Product') },
  ]);

  ngOnInit(): void {
    this.initialize().catch(() => undefined);
  }

  protected fieldId(key: ProductFieldKey): string {
    return `${FIELD_ID_PREFIX}${key}`;
  }

  protected error(key: ProductFieldKey): string | null {
    return this.errors()[key] ?? null;
  }

  protected unitLabel(unit: string): string {
    return capitalize(unit);
  }

  protected taxLabel(rate: number): string {
    return rate === 0 ? 'No tax (0%)' : `${rate}%`;
  }

  protected setToggle(key: ToggleKey, checked: boolean): void {
    this.form.controls[key].setValue(checked);
    this.form.markAsDirty();
  }

  protected scanBarcode(): void {
    this.notificationService.showSampleOnly('Barcode scanning');
  }

  protected cancel(): void {
    if (!this.readOnly() && this.form.dirty) {
      this.confirmingCancel.set(true);
      return;
    }
    this.goToList();
  }

  protected keepEditing(): void {
    this.confirmingCancel.set(false);
  }

  protected goToList(): void {
    this.router.navigate(['/products']).catch(() => undefined);
  }

  protected save(addAnother: boolean): void {
    this.persist(addAnother).catch(() => undefined);
  }

  private async initialize(): Promise<void> {
    const [settings, products] = await Promise.all([
      firstValueFrom(this.settingsDataService.get()),
      firstValueFrom(this.productDataService.getAll()),
    ]);
    this.defaultReorderLevel = settings.defaultReorderLevel;
    this.allProducts.set(products);
    this.categories.set(listCategories(products));
    if (this.mode === 'create') {
      this.resetForm();
    } else if (!this.loadExisting(products)) {
      this.notFound.set(true);
    }
    if (this.readOnly()) this.form.disable();
    this.loaded.set(true);
  }

  private loadExisting(products: readonly Product[]): boolean {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const product = ID_PATTERN.test(id)
      ? products.find(candidate => candidate.id === id)
      : undefined;
    if (!product) return false;
    this.product.set(product);
    this.form.reset({
      name: product.name,
      unit: product.unit,
      genericName: product.genericName,
      category: product.category,
      manufacturer: product.manufacturer,
      sku: product.sku,
      barcode: product.barcode,
      costPrice: formatRupeesInput(product.costCents),
      sellingPrice: formatRupeesInput(product.priceCents),
      taxRate: String(product.taxRatePercent),
      reorderLevel: String(product.reorderLevel),
      openingStock: String(getStockOnHand(product)),
      shelfLocation: product.shelfLocation,
      trackBatches: product.trackBatches,
      prescriptionRequired: product.prescriptionRequired,
      active: product.active,
      showInPosQuickList: product.showInPosQuickList,
    });
    if (product.batches.length > 0) {
      this.form.controls.openingStock.disable();
      this.form.controls.trackBatches.disable();
    }
    return true;
  }

  private resetForm(): void {
    this.form.reset({ reorderLevel: String(this.defaultReorderLevel) });
    this.errors.set({});
  }

  private async persist(addAnother: boolean): Promise<void> {
    if (this.readOnly() || this.saving() || !this.permissionService.canWrite(this.moduleKey))
      return;
    this.saving.set(true);
    try {
      const products = await firstValueFrom(this.productDataService.getAll());
      const input: ProductFormInput = this.form.getRawValue();
      const result = validateProduct(input, {
        existingProducts: products,
        editingId: this.product()?.id ?? null,
        defaultReorderLevel: this.defaultReorderLevel,
      });
      this.errors.set(result.errors);
      if (result.values === null) {
        this.focusField(result.firstErrorField);
        return;
      }
      await this.store(result.values, addAnother);
    } finally {
      this.saving.set(false);
    }
  }

  private async store(values: ValidatedProductValues, addAnother: boolean): Promise<void> {
    try {
      await firstValueFrom(this.productDataService.save(this.buildProduct(values)));
    } catch (error) {
      if (!(error instanceof DuplicateSkuError)) throw error;
      this.errors.set({ sku: 'That SKU is already used by another product' });
      this.focusField('sku');
      return;
    }
    this.notificationService.show('success', `${values.name} saved.`);
    this.form.markAsPristine();
    if (!addAnother) {
      this.goToList();
    } else if (this.mode === 'create') {
      this.resetForm();
      this.focusField('name');
    } else {
      this.router.navigate(['/products', 'new']).catch(() => undefined);
    }
  }

  private buildProduct(values: ValidatedProductValues): Product {
    const original = this.product();
    const flags = this.form.getRawValue();
    return {
      id: original?.id ?? '',
      name: values.name,
      genericName: values.genericName,
      category: values.category,
      form: original?.form ?? capitalize(values.unit),
      unit: values.unit,
      sku: values.sku,
      barcode: values.barcode,
      manufacturer: values.manufacturer,
      costCents: values.costCents,
      priceCents: values.priceCents,
      reorderLevel: values.reorderLevel,
      trackBatches: flags.trackBatches,
      stockOnHand: this.hasBatches() ? (original?.stockOnHand ?? 0) : values.openingStock,
      prescriptionRequired: flags.prescriptionRequired,
      active: flags.active,
      taxRatePercent: values.taxRatePercent,
      shelfLocation: values.shelfLocation,
      showInPosQuickList: flags.showInPosQuickList,
      batches: original?.batches ?? [],
    };
  }

  private focusField(key: ProductFieldKey | null): void {
    if (key === null) return;
    this.hostElement.nativeElement.querySelector<HTMLElement>(`#${this.fieldId(key)}`)?.focus();
  }
}
