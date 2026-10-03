import { Component, ElementRef, computed, input, model, viewChildren } from '@angular/core';
import { BadgeComponent } from '../badge/badge.component';
import { MAX_TABS, TabItem } from './tab-item.model';

@Component({
  selector: 'app-tabs',
  imports: [BadgeComponent],
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
})
export class TabsComponent {
  readonly items = input.required<readonly TabItem[]>();
  readonly value = model('');
  readonly ariaLabel = input.required<string>();
  readonly panelId = input<string | null>(null);

  protected readonly visibleItems = computed(() => this.items().slice(0, MAX_TABS));
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  protected select(id: string): void {
    this.value.set(id);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const count = this.visibleItems().length;
    const targets: Record<string, number> = {
      ArrowRight: (index + 1) % count,
      ArrowLeft: (index - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    this.select(this.visibleItems()[target].id);
    this.tabButtons()[target]?.nativeElement.focus();
  }
}
