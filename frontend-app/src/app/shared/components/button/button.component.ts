import { Component, input } from '@angular/core';
import { IconName } from '../../../core/models/shared/icon-name.model';
import { IconComponent } from '../icon/icon.component';

export type ButtonVariant = 'default' | 'primary' | 'soft' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';
export type ButtonTone = 'amber' | 'green' | 'blue' | 'purple' | 'muted' | 'slate';

@Component({
  selector: 'app-button',
  imports: [IconComponent],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  host: {
    '[class.is-block]': 'block()',
    '[class.is-disabled]': 'disabled()',
  },
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('default');
  readonly size = input<ButtonSize>('md');
  readonly icon = input<IconName | null>(null);
  readonly tone = input<ButtonTone | null>(null);
  readonly block = input(false);
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit'>('button');
  readonly ariaLabel = input<string | null>(null);
  readonly ariaExpanded = input<boolean | null>(null);
  readonly ariaControls = input<string | null>(null);
  readonly ariaDescribedBy = input<string | null>(null);
}
