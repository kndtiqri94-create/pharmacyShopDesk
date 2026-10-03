import { Component, input } from '@angular/core';
import { createUniqueId } from '../../utils/unique-id.util';

@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent {
  readonly title = input<string | null>(null);
  readonly subtitle = input<string | null>(null);
  readonly flush = input(false);

  protected readonly titleId = createUniqueId('card-title');
}
