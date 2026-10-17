import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { syncDialogState } from '../../utils/dialog.util';
import { createUniqueId } from '../../utils/unique-id.util';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-side-panel',
  imports: [IconComponent],
  templateUrl: './side-panel.component.html',
  styleUrl: './side-panel.component.scss',
})
export class SidePanelComponent {
  readonly title = input.required<string>();
  readonly open = input(false);
  readonly initialFocus = input<string | null>(null);
  readonly size = input<'md' | 'lg'>('md');
  readonly closed = output<void>();

  protected readonly titleId = createUniqueId('side-panel-title');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      const opened = syncDialogState(element, this.open());
      const selector = this.initialFocus();
      if (opened && selector !== null) element.querySelector<HTMLElement>(selector)?.focus();
    });
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }
}
