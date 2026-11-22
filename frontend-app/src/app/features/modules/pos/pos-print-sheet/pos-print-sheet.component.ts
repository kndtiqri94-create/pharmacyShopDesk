import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { createUniqueId } from '../../../../shared/utils/unique-id.util';

const PRINTING_CLASS = 'sd-printing-receipt';

@Component({
  selector: 'app-pos-print-sheet',
  imports: [ButtonComponent, CdkTrapFocus],
  templateUrl: './pos-print-sheet.component.html',
  styleUrl: './pos-print-sheet.component.scss',
})
export class PosPrintSheetComponent {
  readonly open = input(false);
  readonly heading = input.required<string>();
  readonly printLabel = input('Print');
  readonly closed = output<void>();

  private readonly document = inject(DOCUMENT);

  protected readonly titleId = createUniqueId('print-title');

  constructor() {
    effect(() => {
      const classList = this.document.body.classList;
      if (this.open()) classList.add(PRINTING_CLASS);
      else classList.remove(PRINTING_CLASS);
    });
    inject(DestroyRef).onDestroy(() => this.document.body.classList.remove(PRINTING_CLASS));
  }

  protected print(): void {
    this.document.defaultView?.print();
  }
}
