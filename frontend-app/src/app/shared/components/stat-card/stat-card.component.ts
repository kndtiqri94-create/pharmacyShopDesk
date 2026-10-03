import { Component, input } from '@angular/core';
import { BadgeTone } from '../../../core/models/shared/badge-tone.model';
import { IconName } from '../../../core/models/shared/icon-name.model';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-stat-card',
  imports: [IconComponent],
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly note = input<string | null>(null);
  readonly icon = input.required<IconName>();
  readonly tone = input<BadgeTone>('neutral');
}
