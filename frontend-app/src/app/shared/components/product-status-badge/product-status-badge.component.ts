import { Component, computed, input } from '@angular/core';
import { ProductStatus } from '../../../core/models/enums/product-status.enum';
import { PRODUCT_STATUS_DISPLAY } from '../../../core/utils/status-display.util';
import { BadgeComponent } from '../badge/badge.component';

@Component({
  selector: 'app-product-status-badge',
  imports: [BadgeComponent],
  templateUrl: './product-status-badge.component.html',
})
export class ProductStatusBadgeComponent {
  readonly status = input.required<ProductStatus>();

  protected readonly display = computed(() => PRODUCT_STATUS_DISPLAY[this.status()]);
}
