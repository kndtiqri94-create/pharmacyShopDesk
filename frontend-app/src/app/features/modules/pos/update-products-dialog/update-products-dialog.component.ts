import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Product } from '../../../../core/models/domain/product.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosProductUpdateService } from '../../../../core/services/pos-product-update.service';
import { formatRupeesExact, formatRupeesInput } from '../../../../core/utils/money.util';
import { SEARCH_TEXT_MAX_LENGTH } from '../../../../core/utils/pos-search.util';
import {
  ProductUpdateDiff,
  diffProductUpdate,
  validateProductUpdate,
} from '../../../../core/utils/pos-product-update.util';
import { getStockOnHand } from '../../../../core/utils/stock-status.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PosDialogComponent } from '../pos-dialog/pos-dialog.component';

@Component({
  selector: 'app-update-products-dialog',
  imports: [
    ButtonComponent,
    DataTableCellDirective,
    DataTableComponent,
    PosDialogComponent,
    ...FIELD_IMPORTS,
  ],
  templateUrl: './update-products-dialog.component.html',
  styleUrl: './update-products-dialog.component.scss',
})
export class UpdateProductsDialogComponent {
  readonly open = input(false);
  readonly canChange = input(true);
  readonly closed = output<void>();
  readonly productUpdated = output<void>();

  private readonly productUpdateService = inject(PosProductUpdateService);
  private readonly notificationService = inject(NotificationService);

  protected readonly search = signal('');
  protected readonly results = signal<readonly Product[]>([]);
  protected readonly selected = signal<Product | null>(null);
  protected readonly priceText = signal('');
  protected readonly stockText = signal('');
  protected readonly priceError = signal<string | null>(null);
  protected readonly stockError = signal<string | null>(null);
  protected readonly diff = signal<ProductUpdateDiff | null>(null);
  protected readonly busy = signal(false);
  protected readonly money = formatRupeesExact;
  protected readonly searchMaxLength = SEARCH_TEXT_MAX_LENGTH;
  protected readonly columns: readonly DataTableColumn<Product>[] = [
    { key: 'name', label: 'Product', subValue: row => row.sku },
    { key: 'price', label: 'Price', kind: 'money', value: row => row.priceCents },
    { key: 'stock', label: 'Stock', kind: 'number', value: row => getStockOnHand(row) },
    { key: 'action', label: 'Action' },
  ];

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.reset());
    });
  }

  protected rowKey = (row: Product): string => row.id;

  protected onSearchInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.search.set(text);
    this.productUpdateService
      .search(text)
      .then(found => this.results.set(found))
      .catch(() => undefined);
  }

  protected onPriceInput(event: Event): void {
    this.priceText.set((event.target as HTMLInputElement).value);
    this.priceError.set(null);
  }

  protected onStockInput(event: Event): void {
    this.stockText.set((event.target as HTMLInputElement).value);
    this.stockError.set(null);
  }

  protected choose(product: Product): void {
    this.selected.set(product);
    this.priceText.set(formatRupeesInput(product.priceCents));
    this.stockText.set(String(getStockOnHand(product)));
    this.priceError.set(null);
    this.stockError.set(null);
    this.diff.set(null);
  }

  protected backToSearch(): void {
    this.selected.set(null);
    this.diff.set(null);
  }

  protected review(): void {
    const product = this.selected();
    if (product === null) return;
    const validation = validateProductUpdate(this.priceText(), this.stockText());
    this.priceError.set(validation.errors.price ?? null);
    this.stockError.set(validation.errors.stock ?? null);
    if (validation.values === null) return;
    const diff = diffProductUpdate(product, validation.values);
    if (!diff.priceChanged && !diff.stockChanged) {
      this.priceError.set('Nothing changed. Edit the price or the stock first.');
      return;
    }
    this.diff.set(diff);
  }

  protected cancelReview(): void {
    this.diff.set(null);
  }

  protected confirmSave(): void {
    this.persist().catch(() => undefined);
  }

  private reset(): void {
    this.search.set('');
    this.results.set([]);
    this.selected.set(null);
    this.diff.set(null);
  }

  private async persist(): Promise<void> {
    const product = this.selected();
    if (product === null) return;
    this.busy.set(true);
    try {
      const result = await this.productUpdateService.save(
        product.id,
        this.priceText(),
        this.stockText(),
        true
      );
      this.diff.set(null);
      if (!result.ok) {
        this.notificationService.show('warning', result.message);
        return;
      }
      this.selected.set(null);
      this.results.set(await this.productUpdateService.search(this.search()));
      this.productUpdated.emit();
    } finally {
      this.busy.set(false);
    }
  }
}
