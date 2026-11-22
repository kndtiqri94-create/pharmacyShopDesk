import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { GrnTotals } from '../../../../core/utils/grn-totals.util';
import { formatRupees } from '../../../../core/utils/money.util';
import { pluralize } from '../../../../core/utils/text.util';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';

@Component({
  selector: 'app-grn-totals-card',
  imports: [...FIELD_IMPORTS, CardComponent, ReactiveFormsModule],
  templateUrl: './grn-totals-card.component.html',
  styleUrl: './grn-totals-card.component.scss',
})
export class GrnTotalsCardComponent {
  readonly totals = input.required<GrnTotals>();
  readonly discountControl = input.required<FormControl<string>>();
  readonly discountError = input<string | null>(null);

  protected readonly formatRupees = formatRupees;

  protected summary(totals: GrnTotals): string {
    return `${pluralize(totals.lineCount, 'line')} · ${pluralize(totals.unitCount, 'unit')}`;
  }
}
