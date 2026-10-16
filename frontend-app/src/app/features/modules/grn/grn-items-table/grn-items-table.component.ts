import { Component, input, output } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { Product } from '../../../../core/models/domain/product.model';
import { formatMoneyCell } from '../../../../core/utils/money.util';
import { parseCents } from '../../../../core/utils/number-input.util';
import {
  GrnFieldErrors,
  GrnLineField,
  grnLineKey,
} from '../../../../core/utils/grn-validation.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { GrnLineGroup } from '../grn-form/grn-line-form';

@Component({
  selector: 'app-grn-items-table',
  imports: [ButtonComponent, ReactiveFormsModule],
  templateUrl: './grn-items-table.component.html',
  styleUrl: './grn-items-table.component.scss',
})
export class GrnItemsTableComponent {
  readonly lines = input.required<FormArray<GrnLineGroup>>();
  readonly productsById = input.required<ReadonlyMap<string, Product>>();
  readonly orderedByProduct = input.required<ReadonlyMap<string, number>>();
  readonly lineTotals = input.required<readonly number[]>();
  readonly errors = input.required<GrnFieldErrors>();
  readonly shortDated = input.required<ReadonlySet<number>>();
  readonly readOnly = input(false);

  readonly removeLine = output<number>();

  protected productName(group: GrnLineGroup): string {
    return this.productsById().get(group.controls.productId.value)?.name ?? 'Unknown item';
  }

  protected productCaption(group: GrnLineGroup): string {
    const productId = group.controls.productId.value;
    const sku = this.productsById().get(productId)?.sku ?? '';
    const ordered = this.orderedByProduct().get(productId);
    return ordered === undefined ? sku : `${sku} · ordered ${ordered}`;
  }

  protected fieldId(index: number, field: GrnLineField): string {
    return `grn-${grnLineKey(index, field)}`;
  }

  protected error(index: number, field: GrnLineField): string | null {
    return this.errors()[grnLineKey(index, field)] ?? null;
  }

  protected hasProblem(index: number, field: GrnLineField): boolean {
    return (
      this.error(index, field) !== null || (field === 'expiry' && this.shortDated().has(index))
    );
  }

  protected describedBy(index: number, field: GrnLineField): string | null {
    return this.error(index, field) === null ? null : `${this.fieldId(index, field)}-error`;
  }

  protected priceText(group: GrnLineGroup): string {
    const cents = parseCents(group.controls.price.value);
    return cents === null ? '' : formatMoneyCell(cents);
  }

  protected totalText(index: number): string {
    return formatMoneyCell(this.lineTotals()[index] ?? 0);
  }
}
