import { Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';
import { Product } from '../../../core/models/domain/product.model';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-product-picker',
  imports: [ButtonComponent],
  templateUrl: './product-picker.component.html',
  styleUrl: './product-picker.component.scss',
})
export class ProductPickerComponent {
  readonly products = input.required<readonly Product[]>();

  readonly picked = output<string>();
  readonly dismissed = output<void>();

  private readonly choice = viewChild.required<ElementRef<HTMLSelectElement>>('choice');

  constructor() {
    afterNextRender(() => this.choice().nativeElement.focus());
  }

  protected onChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    if (this.products().some(product => product.id === id)) this.picked.emit(id);
  }
}
