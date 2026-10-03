import { Component, computed, input } from '@angular/core';

export type FieldSize = 'md' | 'lg';

@Component({
  selector: 'app-field',
  templateUrl: './field.component.html',
  styleUrl: './field.component.scss',
  host: {
    '[class]': 'spanClass()',
  },
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly fieldId = input.required<string>();
  readonly required = input(false);
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly prefix = input<string | null>(null);
  readonly suffix = input<string | null>(null);
  readonly span = input(12);
  readonly size = input<FieldSize>('md');

  protected readonly spanClass = computed(() => `sd-col-${Math.min(Math.max(1, this.span()), 12)}`);
  readonly describedBy = computed(() => {
    if (this.error()) return `${this.fieldId()}-error`;
    if (this.hint()) return `${this.fieldId()}-hint`;
    return null;
  });
}
