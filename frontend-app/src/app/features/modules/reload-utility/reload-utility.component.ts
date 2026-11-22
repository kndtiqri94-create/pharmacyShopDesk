import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CanWriteDirective } from '../../../core/directives/permission-write.directive';
import { ReloadFloat } from '../../../core/models/domain/reload-float.model';
import { ReloadTransaction } from '../../../core/models/domain/reload-transaction.model';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { ReloadDataService } from '../../../core/services/data/reload-data.service';
import { SettingsDataService } from '../../../core/services/data/settings-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ReloadService } from '../../../core/services/reload.service';
import { formatRupees } from '../../../core/utils/money.util';
import { currentFloat, sortTransactionsNewestFirst } from '../../../core/utils/reload-summary.util';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { BillPaymentCardComponent } from './bill-payment-card/bill-payment-card.component';
import { MobileReloadCardComponent } from './mobile-reload-card/mobile-reload-card.component';
import { RecentTransactionsComponent } from './recent-transactions/recent-transactions.component';
import { ReloadFloatCardComponent } from './reload-float-card/reload-float-card.component';
import { TopUpDialogComponent } from './top-up-dialog/top-up-dialog.component';

@Component({
  selector: 'app-reload-utility',
  imports: [
    BadgeComponent,
    BillPaymentCardComponent,
    ButtonComponent,
    CanWriteDirective,
    MobileReloadCardComponent,
    PageHeaderComponent,
    RecentTransactionsComponent,
    ReloadFloatCardComponent,
    TopUpDialogComponent,
  ],
  templateUrl: './reload-utility.component.html',
  styleUrl: './reload-utility.component.scss',
})
export class ReloadUtilityComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly reloadDataService = inject(ReloadDataService);
  private readonly reloadService = inject(ReloadService);
  private readonly settingsDataService = inject(SettingsDataService);

  protected readonly moduleKey = ModuleKey.RELOAD_UTILITY;
  protected readonly topUpOpen = signal(false);
  protected readonly topUpBusy = signal(false);
  protected readonly topUpError = signal<string | null>(null);

  private readonly floatHistory = signal<readonly ReloadFloat[]>([]);
  private readonly allTransactions = signal<readonly ReloadTransaction[]>([]);

  protected readonly lowFloatCents = signal(0);
  protected readonly canWrite = computed(() => this.permissionService.canWrite(this.moduleKey));
  protected readonly float = computed(() => currentFloat(this.floatHistory()));
  protected readonly transactions = computed(() =>
    sortTransactionsNewestFirst(this.allTransactions())
  );

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    this.load().catch(() => undefined);
  }

  protected showStatementMessage(): void {
    this.notificationService.showSampleOnly('Statement');
  }

  protected openTopUp(): void {
    if (!this.canWrite()) return;
    this.topUpError.set(null);
    this.topUpOpen.set(true);
  }

  protected closeTopUp(): void {
    if (!this.topUpBusy()) this.topUpOpen.set(false);
  }

  protected confirmTopUp(amountCents: number): void {
    this.topUp(amountCents).catch(() => undefined);
  }

  private async topUp(amountCents: number): Promise<void> {
    if (this.topUpBusy()) return;
    this.topUpBusy.set(true);
    try {
      const result = await this.reloadService.topUpFloat(amountCents);
      if (!result.ok) {
        this.topUpError.set(
          result.reason === 'denied'
            ? 'You may not have access to top up the float.'
            : 'That amount could not be added. Check it and try again.'
        );
        return;
      }
      this.topUpOpen.set(false);
      this.notificationService.show(
        'success',
        `Float topped up by ${formatRupees(amountCents)}. Available float is now ${formatRupees(result.float.availableCents)}.`
      );
      await this.load();
    } finally {
      this.topUpBusy.set(false);
    }
  }

  private async load(): Promise<void> {
    const [history, transactions, settings] = await Promise.all([
      firstValueFrom(this.reloadDataService.getFloatHistory()),
      firstValueFrom(this.reloadDataService.getTransactions()),
      firstValueFrom(this.settingsDataService.get()),
    ]);
    this.floatHistory.set(history);
    this.allTransactions.set(transactions);
    this.lowFloatCents.set(settings.lowFloatCents);
  }
}
