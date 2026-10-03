import { Component, input, model } from '@angular/core';
import { formatCount } from '../../../core/utils/money.util';
import { ChipItem } from './chip-item.model';

@Component({
  selector: 'app-chips',
  templateUrl: './chips.component.html',
  styleUrl: './chips.component.scss',
})
export class ChipsComponent {
  readonly items = input.required<readonly ChipItem[]>();
  readonly value = model('');
  readonly ariaLabel = input.required<string>();

  protected readonly formatCount = formatCount;

  protected select(id: string): void {
    this.value.set(id);
  }
}
