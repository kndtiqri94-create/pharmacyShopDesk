import { Component, inject, input } from '@angular/core';
import { ReloadTransaction } from '../../../../core/models/domain/reload-transaction.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatTime } from '../../../../core/utils/date.util';
import {
  RELOAD_STATUS_DISPLAY,
  RELOAD_TYPE_LABEL,
} from '../../../../core/utils/status-display.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-recent-transactions',
  imports: [
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    DataTableCellDirective,
    DataTableComponent,
  ],
  templateUrl: './recent-transactions.component.html',
  styleUrl: './recent-transactions.component.scss',
})
export class RecentTransactionsComponent {
  readonly transactions = input.required<readonly ReloadTransaction[]>();

  private readonly notificationService = inject(NotificationService);

  protected readonly statusOf = (row: ReloadTransaction) => RELOAD_STATUS_DISPLAY[row.status];
  protected readonly rowKey = (row: ReloadTransaction): string => row.id;
  protected readonly columns: readonly DataTableColumn<ReloadTransaction>[] = [
    { key: 'time', label: 'Time', value: row => formatTime(row.occurredAt) },
    {
      key: 'provider',
      label: 'Provider',
      value: row => row.provider,
      subValue: row => RELOAD_TYPE_LABEL[row.type],
    },
    { key: 'reference', label: 'Number or account', kind: 'code', value: row => row.reference },
    { key: 'amount', label: 'Amount', kind: 'money', value: row => row.amountCents },
    { key: 'commission', label: 'Commission', kind: 'money', value: row => row.commissionCents },
    { key: 'status', label: 'Status' },
  ];

  protected showExportMessage(): void {
    this.notificationService.showSampleOnly('Export');
  }
}
