import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { AppUser } from '../../../../core/models/domain/app-user.model';
import { Employee } from '../../../../core/models/domain/employee.model';
import { LeaveRequest } from '../../../../core/models/domain/leave-request.model';
import { LeaveType } from '../../../../core/models/domain/leave-type.model';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { ClockService } from '../../../../core/services/clock.service';
import {
  LeaveAdminResult,
  LeaveAdminService,
  LeaveDecision,
} from '../../../../core/services/leave-admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { formatDate } from '../../../../core/utils/date.util';
import { SEARCH_MAX_LENGTH } from '../../../../core/utils/product-list-filter.util';
import {
  EMPLOYEE_PAGE_SIZES,
  parseEmployeePageSize,
} from '../../../../core/utils/employee-list.util';
import { formatLeaveDays } from '../../../../core/utils/leave-balance.util';
import {
  LeaveListRow,
  LeaveStatusFilter,
  buildLeaveListRows,
  buildLeaveStatusChips,
  filterLeaveRows,
  paginateLeaveRows,
  parseLeaveStatusFilter,
} from '../../../../core/utils/leave-list.util';
import { canCancelLeave, canDecideLeave } from '../../../../core/utils/leave-status.util';
import { LEAVE_STATUS_DISPLAY } from '../../../../core/utils/status-display.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ChipsComponent } from '../../../../shared/components/chips/chips.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { LeaveDecisionDialogComponent } from './leave-decision-dialog/leave-decision-dialog.component';
import { LeaveDetailsDialogComponent } from './leave-details-dialog/leave-details-dialog.component';

interface PendingDecision {
  row: LeaveListRow;
  decision: LeaveDecision;
}

const OUTCOME_WORD: Readonly<Record<LeaveDecision, string>> = {
  APPROVE: 'approved',
  REJECT: 'rejected',
};

@Component({
  selector: 'app-leave-requests',
  imports: [
    ...FIELD_IMPORTS,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    ChipsComponent,
    ConfirmDialogComponent,
    DataTableCellDirective,
    DataTableComponent,
    EmptyStateComponent,
    LeaveDecisionDialogComponent,
    LeaveDetailsDialogComponent,
    PaginationComponent,
  ],
  templateUrl: './leave-requests.component.html',
  styleUrl: './leave-requests.component.scss',
})
export class LeaveRequestsComponent {
  readonly requests = input.required<readonly LeaveRequest[]>();
  readonly employees = input.required<readonly Employee[]>();
  readonly users = input.required<readonly AppUser[]>();
  readonly types = input.required<readonly LeaveType[]>();
  readonly changed = output<void>();

  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly clockService = inject(ClockService);
  private readonly notificationService = inject(NotificationService);
  private readonly adminService = inject(LeaveAdminService);

  protected readonly pageSizes = EMPLOYEE_PAGE_SIZES;
  protected readonly status = signal<LeaveStatusFilter>('all');
  protected readonly keyword = signal('');
  protected readonly keywordMaxLength = SEARCH_MAX_LENGTH;
  protected readonly pageSize = signal<number>(EMPLOYEE_PAGE_SIZES[0]);
  protected readonly page = linkedSignal({
    source: () => ({
      status: this.status(),
      keyword: this.keyword(),
      pageSize: this.pageSize(),
    }),
    computation: () => 1,
  });
  protected readonly viewing = signal<LeaveListRow | null>(null);
  protected readonly pendingDecision = signal<PendingDecision | null>(null);
  protected readonly pendingCancel = signal<LeaveListRow | null>(null);
  protected readonly working = signal(false);

  protected readonly rows = computed(() =>
    buildLeaveListRows(this.requests(), this.employees(), this.types())
  );
  protected readonly chips = computed(() => buildLeaveStatusChips(this.requests()));
  protected readonly filtered = computed(() =>
    filterLeaveRows(this.rows(), this.status(), this.keyword())
  );
  protected readonly pageData = computed(() =>
    paginateLeaveRows(this.filtered(), this.page(), this.pageSize())
  );
  protected readonly cancelTitle = computed(() => {
    const target = this.pendingCancel();
    return target === null ? '' : `Cancel leave for ${target.employeeName}?`;
  });
  protected readonly cancelMessage = computed(() => {
    const target = this.pendingCancel();
    if (target === null) return '';
    const { request, employeeName, leaveTypeName } = target;
    return (
      `${employeeName}'s ${leaveTypeName} from ${formatDate(request.fromDate)} to ` +
      `${formatDate(request.toDate)} will be cancelled and its days given back. You cannot undo this.`
    );
  });

  protected readonly columns: readonly DataTableColumn<LeaveListRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      value: row => row.employeeName,
      subValue: row => row.employeeCode,
    },
    { key: 'type', label: 'Leave Type', value: row => row.leaveTypeName },
    { key: 'from', label: 'From', value: row => formatDate(row.request.fromDate) },
    { key: 'to', label: 'To', value: row => formatDate(row.request.toDate) },
    {
      key: 'days',
      label: 'Days',
      kind: 'number',
      value: row => formatLeaveDays(row.request.days),
    },
    { key: 'reason', label: 'Reason', value: row => row.request.reason },
    { key: 'approver', label: 'Approver', value: row => row.approverName },
    { key: 'status', label: 'Status' },
    { key: 'action', label: 'Action' },
  ];
  protected readonly rowKey = (row: LeaveListRow): string => row.request.id;
  protected readonly statusOf = (row: LeaveListRow) => LEAVE_STATUS_DISPLAY[row.request.status];

  protected canDecide(row: LeaveListRow): boolean {
    return canDecideLeave(
      row.request,
      {
        user: this.authService.currentUser(),
        canOpenEmployees: this.permissionService.canView(ModuleKey.EMPLOYEES),
      },
      this.employees(),
      this.users()
    );
  }

  protected canCancel(row: LeaveListRow): boolean {
    return (
      this.permissionService.canWrite(ModuleKey.EMPLOYEES) &&
      canCancelLeave(row.request, this.clockService.today())
    );
  }

  protected onStatus(value: string): void {
    this.status.set(parseLeaveStatusFilter(value));
  }

  protected onKeyword(event: Event): void {
    this.keyword.set((event.target as HTMLInputElement).value.slice(0, SEARCH_MAX_LENGTH));
  }

  protected resetFilters(): void {
    this.status.set('all');
    this.keyword.set('');
  }

  protected openDetails(row: LeaveListRow): void {
    this.viewing.set(row);
  }

  protected closeDetails(): void {
    this.viewing.set(null);
  }

  protected onPageSize(event: Event): void {
    this.pageSize.set(parseEmployeePageSize(Number((event.target as HTMLSelectElement).value)));
  }

  protected startDecision(row: LeaveListRow, decision: LeaveDecision): void {
    if (this.canDecide(row)) this.pendingDecision.set({ row, decision });
  }

  protected closeDecision(): void {
    if (!this.working()) this.pendingDecision.set(null);
  }

  protected async confirmDecision(comment: string): Promise<void> {
    const pending = this.pendingDecision();
    if (pending === null || this.working()) return;
    const { row, decision } = pending;
    const result = await this.run(() =>
      this.adminService.decide(row.request.id, decision, comment)
    );
    this.pendingDecision.set(null);
    this.announce(result, row, `${row.employeeName}'s leave was ${OUTCOME_WORD[decision]}.`);
  }

  protected startCancel(row: LeaveListRow): void {
    if (this.canCancel(row)) this.pendingCancel.set(row);
  }

  protected closeCancel(): void {
    if (!this.working()) this.pendingCancel.set(null);
  }

  protected async confirmCancel(): Promise<void> {
    const target = this.pendingCancel();
    if (target === null || this.working()) return;
    const result = await this.run(() => this.adminService.cancel(target.request.id));
    this.pendingCancel.set(null);
    this.announce(result, target, `${target.employeeName}'s leave was cancelled.`);
  }

  private async run(action: () => Promise<LeaveAdminResult>): Promise<LeaveAdminResult> {
    this.working.set(true);
    try {
      return await action();
    } finally {
      this.working.set(false);
    }
  }

  private announce(result: LeaveAdminResult, row: LeaveListRow, success: string): void {
    this.notificationService.show(
      result.ok ? 'success' : 'warning',
      result.ok ? success : this.failureMessage(result, row)
    );
    this.changed.emit();
  }

  private failureMessage(
    result: Extract<LeaveAdminResult, { ok: false }>,
    row: LeaveListRow
  ): string {
    switch (result.reason) {
      case 'denied':
        return 'You do not have access to change leave requests.';
      case 'busy':
        return 'Another change is still saving. Try again.';
      case 'not-found':
        return `${row.employeeName}'s leave request is no longer in the list.`;
      case 'not-allowed':
        return `${row.employeeName}'s leave request cannot be changed by you any more.`;
      default:
        return result.errors['approverComment'] ?? 'Check the comment and try again.';
    }
  }
}
