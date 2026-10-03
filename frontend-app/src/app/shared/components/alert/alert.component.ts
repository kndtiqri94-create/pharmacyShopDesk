import { Component, computed, input } from '@angular/core';
import { IconName } from '../../../core/models/shared/icon-name.model';
import { IconComponent } from '../icon/icon.component';

export type AlertTone = 'info' | 'warning' | 'success';

const ALERT_ICONS: Record<AlertTone, IconName> = {
  info: 'info',
  warning: 'alert',
  success: 'check',
};

@Component({
  selector: 'app-alert',
  imports: [IconComponent],
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.scss',
})
export class AlertComponent {
  readonly tone = input<AlertTone>('info');
  readonly title = input<string | null>(null);

  protected readonly iconName = computed(() => ALERT_ICONS[this.tone()]);
}
