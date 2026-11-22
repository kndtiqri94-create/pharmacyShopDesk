import { Component, computed, input } from '@angular/core';
import { PaymentStatus } from '../../../../core/models/enums/payment-status.enum';
import { PAYMENT_STATUS_DISPLAY } from '../../../../core/utils/status-display.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';

@Component({
  selector: 'app-payment-status-badge',
  imports: [BadgeComponent],
  templateUrl: './payment-status-badge.component.html',
})
export class PaymentStatusBadgeComponent {
  readonly status = input.required<PaymentStatus>();

  protected readonly display = computed(() => PAYMENT_STATUS_DISPLAY[this.status()]);
}
