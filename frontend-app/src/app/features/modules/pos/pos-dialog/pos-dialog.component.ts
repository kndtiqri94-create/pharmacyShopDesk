import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { syncDialogState } from '../../../../shared/utils/dialog.util';
import { createUniqueId } from '../../../../shared/utils/unique-id.util';

export type PosDialogSize = 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-pos-dialog',
  imports: [ButtonComponent],
  templateUrl: './pos-dialog.component.html',
  styleUrl: './pos-dialog.component.scss',
})
export class PosDialogComponent {
  readonly open = input(false);
  readonly heading = input.required<string>();
  readonly size = input<PosDialogSize>('md');
  readonly closed = output<void>();

  protected readonly titleId = createUniqueId('pos-dialog-title');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      syncDialogState(this.dialog().nativeElement, this.open());
    });
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }
}
