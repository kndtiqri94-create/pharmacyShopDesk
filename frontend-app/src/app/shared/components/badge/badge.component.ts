import { Component, input } from '@angular/core';
import { BadgeTone } from '../../../core/models/shared/badge-tone.model';

@Component({
  selector: 'app-badge',
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.scss',
})
export class BadgeComponent {
  readonly label = input.required<string>();
  readonly tone = input<BadgeTone>('neutral');
  readonly plain = input(false);
}
