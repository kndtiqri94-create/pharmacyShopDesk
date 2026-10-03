import { Component, input } from '@angular/core';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-progress-bar',
  templateUrl: './progress-bar.component.html',
  styleUrl: './progress-bar.component.scss',
})
export class ProgressBarComponent {
  readonly value = input.required<number>();
  readonly max = input(100);
  readonly label = input.required<string>();
  readonly tone = input<ProgressTone>('primary');
}
