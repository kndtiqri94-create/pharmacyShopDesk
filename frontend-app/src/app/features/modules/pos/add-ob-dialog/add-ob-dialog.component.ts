import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ClockService } from '../../../../core/services/clock.service';
import {
  BroughtForward,
  DayStatus,
  PosCashService,
} from '../../../../core/services/pos-cash.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatDate, formatTime } from '../../../../core/utils/date.util';
import { formatRupeesExact, formatRupeesInput } from '../../../../core/utils/money.util';
import { parseOpeningBalance } from '../../../../core/utils/opening-balance.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PosDialogComponent } from '../pos-dialog/pos-dialog.component';

@Component({
  selector: 'app-add-ob-dialog',
  imports: [AlertComponent, ButtonComponent, PosDialogComponent, ...FIELD_IMPORTS],
  templateUrl: './add-ob-dialog.component.html',
  styleUrl: './add-ob-dialog.component.scss',
})
export class AddObDialogComponent {
  readonly open = input(false);
  readonly canChange = input(true);
  readonly closed = output<void>();

  private readonly cashService = inject(PosCashService);
  private readonly clockService = inject(ClockService);
  private readonly notificationService = inject(NotificationService);

  protected readonly status = signal<DayStatus | null>(null);
  protected readonly amountText = signal('');
  protected readonly broughtForward = signal<BroughtForward | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly confirming = signal(false);
  protected readonly busy = signal(false);
  protected readonly money = formatRupeesExact;
  protected readonly dateOf = formatDate;
  protected readonly timeOf = formatTime;
  protected readonly today = this.clockService.today();

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.load());
    });
  }

  protected onAmountInput(event: Event): void {
    this.amountText.set((event.target as HTMLInputElement).value);
    this.error.set(null);
  }

  protected save(): void {
    const parsed = parseOpeningBalance(this.amountText());
    if (!parsed.ok) {
      this.error.set(parsed.message);
      return;
    }
    const existing = this.status()?.opening ?? null;
    if (existing !== null && existing.amountCents !== parsed.cents) {
      this.confirming.set(true);
      return;
    }
    this.persist(false);
  }

  protected confirmChange(): void {
    this.persist(true);
  }

  protected keep(): void {
    this.confirming.set(false);
  }

  private persist(confirmChange: boolean): void {
    this.submit(confirmChange).catch(() => undefined);
  }

  private async submit(confirmChange: boolean): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.cashService.saveOpening(this.amountText(), confirmChange);
      this.confirming.set(false);
      if (!result.ok) {
        this.error.set(result.message);
        return;
      }
      this.notificationService.show('success', 'Opening balance saved.');
      this.status.set(await this.cashService.status(this.today));
      this.error.set(null);
    } finally {
      this.busy.set(false);
    }
  }

  private load(): void {
    this.confirming.set(false);
    this.error.set(null);
    this.broughtForward.set(null);
    this.loadStatus().catch(() => undefined);
  }

  private async loadStatus(): Promise<void> {
    const status = await this.cashService.status(this.today);
    this.status.set(status);
    if (status.opening !== null) {
      this.amountText.set(formatRupeesInput(status.opening.amountCents));
      return;
    }
    const carried = status.counterClosed
      ? null
      : await this.cashService.broughtForwardFor(this.today);
    this.broughtForward.set(carried);
    this.amountText.set(carried === null ? '' : formatRupeesInput(carried.cents));
  }
}
