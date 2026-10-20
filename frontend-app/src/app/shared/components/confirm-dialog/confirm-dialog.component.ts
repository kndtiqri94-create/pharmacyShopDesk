import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { syncDialogState } from '../../utils/dialog.util';
import { createUniqueId } from '../../utils/unique-id.util';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-confirm-dialog',
  imports: [ButtonComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input('Cancel');
  readonly showCancel = input(true);
  readonly open = input(false);
  readonly busy = input(false);
  readonly danger = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly titleId = createUniqueId('confirm-title');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => syncDialogState(this.dialog().nativeElement, this.open()));
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    if (!this.busy()) this.cancelled.emit();
  }
}
