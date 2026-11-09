import { Component, input, output } from '@angular/core';
import { Product } from '../../../../core/models/domain/product.model';
import { formatRupeesExact } from '../../../../core/utils/money.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { PosDialogComponent } from '../pos-dialog/pos-dialog.component';

@Component({
  selector: 'app-pos-item-details-dialog',
  imports: [ButtonComponent, PosDialogComponent],
  templateUrl: './pos-item-details-dialog.component.html',
  styleUrl: './pos-item-details-dialog.component.scss',
})
export class PosItemDetailsDialogComponent {
  readonly open = input(false);
  readonly product = input<Product | null>(null);
  readonly canSeeCost = input(false);
  readonly closed = output<void>();

  protected readonly money = formatRupeesExact;
}
