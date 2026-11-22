import { Component, computed, input } from '@angular/core';
import { PoStatus } from '../../../../core/models/enums/po-status.enum';
import { PO_STATUS_DISPLAY } from '../../../../core/utils/status-display.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';

@Component({
  selector: 'app-po-status-badge',
  imports: [BadgeComponent],
  templateUrl: './po-status-badge.component.html',
})
export class PoStatusBadgeComponent {
  readonly status = input.required<PoStatus>();

  protected readonly display = computed(() => PO_STATUS_DISPLAY[this.status()]);
}
