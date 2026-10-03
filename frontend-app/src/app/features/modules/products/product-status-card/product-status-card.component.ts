import { Component, input, model } from '@angular/core';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';

@Component({
  selector: 'app-product-status-card',
  imports: [CardComponent, ToggleComponent],
  templateUrl: './product-status-card.component.html',
  styleUrl: './product-status-card.component.scss',
})
export class ProductStatusCardComponent {
  readonly active = model(true);
  readonly showInPosQuickList = model(true);
  readonly disabled = input(false);
}
