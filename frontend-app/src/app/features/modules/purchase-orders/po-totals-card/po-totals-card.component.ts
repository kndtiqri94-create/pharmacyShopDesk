import { Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { formatDate } from '../../../../core/utils/date.util';
import { formatRupees } from '../../../../core/utils/money.util';
import { PurchaseOrderTotals } from '../../../../core/utils/purchase-order-totals.util';
import { pluralize } from '../../../../core/utils/text.util';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';

@Component({
  selector: 'app-po-totals-card',
  imports: [...FIELD_IMPORTS, CardComponent, ReactiveFormsModule],
  templateUrl: './po-totals-card.component.html',
  styleUrl: './po-totals-card.component.scss',
})
export class PoTotalsCardComponent {
  readonly totals = input.required<PurchaseOrderTotals>();
  readonly expectedDate = input('');
  readonly deliveryControl = input.required<FormControl<string>>();
  readonly deliveryError = input<string | null>(null);

  protected readonly formatRupees = formatRupees;
  protected readonly summary = computed(() => {
    const totals = this.totals();
    return `${pluralize(totals.lineCount, 'line')} · ${pluralize(totals.unitCount, 'unit')}`;
  });
  protected readonly expectedText = computed(() => {
    const date = this.expectedDate();
    return date === '' ? 'Not set yet' : formatDate(date);
  });
}
