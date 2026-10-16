import { Component, input, output } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { Product } from '../../../../core/models/domain/product.model';
import { formatCount, formatMoneyCell } from '../../../../core/utils/money.util';
import {
  PurchaseOrderFieldErrors,
  PurchaseOrderLineField,
  purchaseOrderLineKey,
} from '../../../../core/utils/purchase-order-validation.util';
import { getStockOnHand } from '../../../../core/utils/stock-status.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { PurchaseOrderLineGroup } from '../purchase-order-form/purchase-order-line-form';

@Component({
  selector: 'app-po-items-table',
  imports: [ButtonComponent, ReactiveFormsModule],
  templateUrl: './po-items-table.component.html',
  styleUrl: './po-items-table.component.scss',
})
export class PoItemsTableComponent {
  readonly lines = input.required<FormArray<PurchaseOrderLineGroup>>();
  readonly productsById = input.required<ReadonlyMap<string, Product>>();
  readonly lineTotals = input.required<readonly number[]>();
  readonly errors = input.required<PurchaseOrderFieldErrors>();
  readonly readOnly = input(false);

  readonly removeLine = output<number>();

  protected product(group: PurchaseOrderLineGroup): Product | undefined {
    return this.productsById().get(group.controls.productId.value);
  }

  protected productName(group: PurchaseOrderLineGroup): string {
    return this.product(group)?.name ?? 'Unknown item';
  }

  protected stockText(group: PurchaseOrderLineGroup): string {
    const product = this.product(group);
    return product ? formatCount(getStockOnHand(product)) : '';
  }

  protected reorderText(group: PurchaseOrderLineGroup): string {
    const product = this.product(group);
    return product ? formatCount(product.reorderLevel) : '';
  }

  protected fieldId(index: number, field: PurchaseOrderLineField): string {
    return `po-${purchaseOrderLineKey(index, field)}`;
  }

  protected error(index: number, field: PurchaseOrderLineField): string | null {
    return this.errors()[purchaseOrderLineKey(index, field)] ?? null;
  }

  protected describedBy(index: number, field: PurchaseOrderLineField): string | null {
    return this.error(index, field) === null ? null : `${this.fieldId(index, field)}-error`;
  }

  protected totalText(index: number): string {
    return formatMoneyCell(this.lineTotals()[index] ?? 0);
  }
}
