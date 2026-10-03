import { Directive, inject } from '@angular/core';
import { FieldComponent } from './field.component';

@Directive({
  selector: '[appFieldControl]',
  host: {
    class: 'sd-field-control',
    '[id]': 'field.fieldId()',
    '[attr.aria-describedby]': 'field.describedBy()',
    '[attr.aria-invalid]': 'field.error() ? "true" : null',
    '[attr.aria-required]': 'field.required() ? "true" : null',
  },
})
export class FieldControlDirective {
  protected readonly field = inject(FieldComponent);
}
