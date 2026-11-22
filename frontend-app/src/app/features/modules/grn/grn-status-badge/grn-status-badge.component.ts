import { Component, computed, input } from '@angular/core';
import { GrnStatus } from '../../../../core/models/enums/grn-status.enum';
import { GRN_STATUS_DISPLAY } from '../../../../core/utils/status-display.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';

@Component({
  selector: 'app-grn-status-badge',
  imports: [BadgeComponent],
  templateUrl: './grn-status-badge.component.html',
})
export class GrnStatusBadgeComponent {
  readonly status = input.required<GrnStatus>();

  protected readonly display = computed(() => GRN_STATUS_DISPLAY[this.status()]);
}
