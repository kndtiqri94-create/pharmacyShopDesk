import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ClockService } from '../../../../core/services/clock.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { CashBookView, PosCashService } from '../../../../core/services/pos-cash.service';
import { formatDate, formatTime } from '../../../../core/utils/date.util';
import { formatRupeesExact } from '../../../../core/utils/money.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { PosDialogComponent } from '../pos-dialog/pos-dialog.component';

@Component({
  selector: 'app-drawer-end-dialog',
  imports: [AlertComponent, ButtonComponent, PosDialogComponent],
  templateUrl: './drawer-end-dialog.component.html',
  styleUrl: './drawer-end-dialog.component.scss',
})
export class DrawerEndDialogComponent {
  readonly open = input(false);
  readonly canChange = input(true);
  readonly closed = output<void>();

  private readonly cashService = inject(PosCashService);
  private readonly clockService = inject(ClockService);
  private readonly notificationService = inject(NotificationService);

  protected readonly view = signal<CashBookView | null>(null);
  protected readonly confirming = signal(false);
  protected readonly busy = signal(false);
  protected readonly today = this.clockService.today();
  protected readonly money = formatRupeesExact;
  protected readonly dateOf = formatDate;
  protected readonly timeOf = formatTime;

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.load());
    });
  }

  protected ask(): void {
    this.confirming.set(true);
  }

  protected keep(): void {
    this.confirming.set(false);
  }

  protected confirmEnd(): void {
    this.endDrawer().catch(() => undefined);
  }

  private load(): void {
    this.confirming.set(false);
    this.cashService
      .view(this.today)
      .then(view => this.view.set(view))
      .catch(() => undefined);
  }

  private async endDrawer(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.cashService.endDrawer();
      this.confirming.set(false);
      if (!result.ok) {
        this.notificationService.show('warning', result.message);
        return;
      }
      this.notificationService.show('success', 'The drawer is ended for today.');
      this.view.set(await this.cashService.view(this.today));
    } finally {
      this.busy.set(false);
    }
  }
}
