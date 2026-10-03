import { Component, input, model } from '@angular/core';

@Component({
  selector: 'app-toggle',
  templateUrl: './toggle.component.html',
  styleUrl: './toggle.component.scss',
})
export class ToggleComponent {
  readonly label = input.required<string>();
  readonly checked = model(false);
  readonly disabled = input(false);

  protected flip(): void {
    this.checked.set(!this.checked());
  }
}
