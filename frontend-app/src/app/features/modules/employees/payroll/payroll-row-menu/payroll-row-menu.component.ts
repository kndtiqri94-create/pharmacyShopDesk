import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IconName } from '../../../../../core/models/shared/icon-name.model';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { createUniqueId } from '../../../../../shared/utils/unique-id.util';

export type PayrollRowAction = 'leave' | 'advance' | 'nopay';

interface MenuItem {
  id: PayrollRowAction;
  label: string;
  icon: IconName;
}

const MENU_HEIGHT_ESTIMATE = 140;
const GAP = 4;

@Component({
  selector: 'app-payroll-row-menu',
  imports: [IconComponent],
  templateUrl: './payroll-row-menu.component.html',
  styleUrl: './payroll-row-menu.component.scss',
  host: { '(document:click)': 'onDocumentClick($event)' },
})
export class PayrollRowMenuComponent {
  readonly employeeName = input.required<string>();
  readonly selected = output<PayrollRowAction>();

  protected readonly items: readonly MenuItem[] = [
    { id: 'leave', label: 'Add Leave', icon: 'calendar' },
    { id: 'advance', label: 'Add Salary Advance', icon: 'wallet' },
    { id: 'nopay', label: 'Add Nopay Amount', icon: 'alert' },
  ];
  protected readonly menuId = createUniqueId('payroll-row-menu');
  protected readonly open = signal(false);
  protected readonly position = signal<Record<string, string>>({});

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly closeOnScroll = () => this.close(false);

  constructor() {
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('scroll', this.closeOnScroll, true)
    );
  }

  protected toggle(): void {
    if (this.open()) this.close(true);
    else this.show();
  }

  protected choose(action: PayrollRowAction): void {
    this.close(false);
    this.selected.emit(action);
  }

  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  protected onMenuKey(event: KeyboardEvent): void {
    const buttons = this.menuButtons();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(true);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    } else if (event.key === 'Tab') {
      this.close(false);
    }
  }

  private show(): void {
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const right = `${Math.max(0, window.innerWidth - rect.right)}px`;
    const below = rect.bottom + MENU_HEIGHT_ESTIMATE < window.innerHeight;
    this.position.set(
      below
        ? { top: `${rect.bottom + GAP}px`, right }
        : { bottom: `${window.innerHeight - rect.top + GAP}px`, right }
    );
    this.open.set(true);
    document.addEventListener('scroll', this.closeOnScroll, true);
    setTimeout(() => this.menuButtons()[0]?.focus());
  }

  private close(returnFocus: boolean): void {
    this.open.set(false);
    document.removeEventListener('scroll', this.closeOnScroll, true);
    if (returnFocus) this.trigger().nativeElement.focus();
  }

  private menuButtons(): HTMLButtonElement[] {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    );
  }
}
