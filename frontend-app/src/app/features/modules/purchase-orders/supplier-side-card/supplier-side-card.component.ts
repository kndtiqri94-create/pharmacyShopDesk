import { Component, input } from '@angular/core';
import { Supplier } from '../../../../core/models/domain/supplier.model';
import { formatRupeesExact } from '../../../../core/utils/money.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { CardComponent } from '../../../../shared/components/card/card.component';

@Component({
  selector: 'app-supplier-side-card',
  imports: [AvatarComponent, CardComponent],
  templateUrl: './supplier-side-card.component.html',
  styleUrl: './supplier-side-card.component.scss',
})
export class SupplierSideCardComponent {
  readonly supplier = input<Supplier | null>(null);
  readonly owedCents = input(0);

  protected readonly formatRupees = formatRupeesExact;
}
