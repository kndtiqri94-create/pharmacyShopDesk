import { Component, computed, input } from '@angular/core';
import { LeaveBalanceRow, formatLeaveDays } from '../../../../../core/utils/leave-balance.util';
import { CardComponent } from '../../../../../shared/components/card/card.component';
import { DataTableColumn } from '../../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-leave-balance-card',
  imports: [CardComponent, DataTableComponent, EmptyStateComponent],
  templateUrl: './leave-balance-card.component.html',
  styleUrl: './leave-balance-card.component.scss',
})
export class LeaveBalanceCardComponent {
  readonly rows = input.required<readonly LeaveBalanceRow[]>();
  readonly hasEmployee = input(false);
  readonly year = input.required<number>();

  protected readonly subtitle = computed(() =>
    this.hasEmployee() ? `Leave year ${this.year()}` : ''
  );
  protected readonly columns: readonly DataTableColumn<LeaveBalanceRow>[] = [
    { key: 'type', label: 'Leave Type', value: row => row.leaveTypeName },
    {
      key: 'entitlement',
      label: 'Entitlement',
      kind: 'number',
      value: row => formatLeaveDays(row.entitlement),
    },
    {
      key: 'balance',
      label: 'Balance',
      kind: 'number',
      value: row => formatLeaveDays(row.balance),
    },
    {
      key: 'utilized',
      label: 'Utilized',
      kind: 'number',
      value: row => formatLeaveDays(row.utilized),
    },
    {
      key: 'pending',
      label: 'Pending Approval',
      kind: 'number',
      value: row => formatLeaveDays(row.pending),
    },
  ];
  protected readonly rowKey = (row: LeaveBalanceRow): string => row.leaveTypeId;
}
