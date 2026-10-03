import { Directive, TemplateRef, inject, input } from '@angular/core';

export interface DataTableCellContext<T> {
  $implicit: T;
}

@Directive({
  selector: 'ng-template[appDataTableCell]',
})
export class DataTableCellDirective<T = unknown> {
  readonly columnKey = input.required<string>({ alias: 'appDataTableCell' });
  readonly template = inject<TemplateRef<DataTableCellContext<T>>>(TemplateRef);
}
