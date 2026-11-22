import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import {
  EMPLOYEE_PAGE_SIZES,
  parseEmployeePageSize,
} from '../../../../../core/utils/employee-list.util';
import { formatMoneyCell } from '../../../../../core/utils/money.util';
import { PayrollRow } from '../../../../../core/services/payroll.service';
import { PayrollTab, paginatePayrollRows } from '../../../../../core/utils/payroll-list.util';
import { PAYROLL_PAYMENT_STATUS_DISPLAY } from '../../../../../core/utils/status-display.util';
import { BadgeComponent } from '../../../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { DataTableCellDirective } from '../../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { PayrollRecordsKind } from '../payroll-records-dialog/payroll-records-dialog.component';
import {
  PayrollRowAction,
  PayrollRowMenuComponent,
} from '../payroll-row-menu/payroll-row-menu.component';

export interface PayrollRecordsEvent {
  row: PayrollRow;
  kind: PayrollRecordsKind;
}

export interface PayrollRowActionEvent {
  row: PayrollRow;
  action: PayrollRowAction;
}

const NOT_APPLICABLE = 'N/A';

function sameEmployees(left: readonly PayrollRow[], right: readonly PayrollRow[]): boolean {
  return (
    left.length === right.length &&
    left.every((row, index) => row.employee.id === right[index].employee.id)
  );
}

@Component({
  selector: 'app-payroll-table',
  imports: [
    BadgeComponent,
    ButtonComponent,
    DataTableCellDirective,
    DataTableComponent,
    EmptyStateComponent,
    PaginationComponent,
    PayrollRowMenuComponent,
  ],
  templateUrl: './payroll-table.component.html',
  styleUrl: './payroll-table.component.scss',
})
export class PayrollTableComponent {
  readonly rows = input.required<readonly PayrollRow[]>();
  readonly tab = input<PayrollTab>('monthly');
  readonly canWrite = input(false);
  readonly resetRequested = output<void>();
  readonly rowAction = output<PayrollRowActionEvent>();
  readonly recordsRequested = output<PayrollRecordsEvent>();

  protected readonly pageSizes = EMPLOYEE_PAGE_SIZES;
  protected readonly pageSize = signal<number>(EMPLOYEE_PAGE_SIZES[0]);
  protected readonly page = linkedSignal<{ rows: readonly PayrollRow[]; pageSize: number }, number>(
    {
      source: () => ({ rows: this.rows(), pageSize: this.pageSize() }),
      computation: (source, previous) =>
        previous !== undefined &&
        previous.source.pageSize === source.pageSize &&
        sameEmployees(previous.source.rows, source.rows)
          ? previous.value
          : 1,
    }
  );
  protected readonly pageData = computed(() =>
    paginatePayrollRows(this.rows(), this.page(), this.pageSize())
  );
  protected readonly isDaily = computed(() => this.tab() === 'daily');

  protected readonly columns = computed<readonly DataTableColumn<PayrollRow>[]>(() => {
    const daily = this.isDaily();
    return [
      {
        key: 'name',
        label: 'Name',
        value: row => row.employee.name,
        subValue: row => row.employee.code,
      },
      {
        key: 'basic',
        label: daily ? 'Daily Rate' : 'Basic Salary',
        kind: 'money',
        value: row => row.pay.basicCents,
      },
      ...(daily
        ? [
            {
              key: 'daysWorked',
              label: 'Days Worked',
              kind: 'number',
              value: (row: PayrollRow) => row.pay.daysWorked ?? NOT_APPLICABLE,
            } as DataTableColumn<PayrollRow>,
          ]
        : []),
      { key: 'allowance', label: 'Allowance', kind: 'money', value: row => row.pay.allowanceCents },
      {
        key: 'commission',
        label: 'Commission',
        kind: 'money',
        value: row => row.pay.commissionCents,
      },
      {
        key: 'advance',
        label: 'Salary Advance',
        kind: 'money',
        value: row => row.pay.salaryAdvanceCents,
      },
      {
        key: 'leaves',
        label: 'Leaves',
        kind: 'number',
        value: row => row.pay.leaves ?? NOT_APPLICABLE,
      },
      { key: 'nopay', label: 'Total Nopay', kind: 'money', value: row => row.pay.totalNopayCents },
      {
        key: 'epf',
        label: 'EPF Deductions',
        kind: 'money',
        value: row => row.pay.epfDeductionCents ?? NOT_APPLICABLE,
      },
      {
        key: 'loan',
        label: 'Loan Deduction',
        kind: 'money',
        value: row => row.pay.loanDeductionCents ?? NOT_APPLICABLE,
      },
      { key: 'tax', label: 'Payee Tax', kind: 'money', value: row => row.pay.payeeTaxCents },
      { key: 'overtime', label: 'Over Time', kind: 'money', value: row => row.pay.overTimeCents },
      { key: 'gross', label: 'Gross Salary', kind: 'money', value: row => row.pay.grossCents },
      { key: 'net', label: 'Net Salary', kind: 'money' },
      { key: 'status', label: 'Payment Status' },
      ...(this.canWrite()
        ? [{ key: 'action', label: 'Action' } as DataTableColumn<PayrollRow>]
        : []),
    ];
  });

  protected readonly rowKey = (row: PayrollRow): string => row.employee.id;
  protected readonly statusOf = (row: PayrollRow) =>
    PAYROLL_PAYMENT_STATUS_DISPLAY[row.pay.paymentStatus];

  protected money(cents: number): string {
    return formatMoneyCell(cents);
  }

  protected net(row: PayrollRow): string {
    return formatMoneyCell(row.pay.netCents);
  }

  protected onPageSize(event: Event): void {
    this.pageSize.set(parseEmployeePageSize(Number((event.target as HTMLSelectElement).value)));
  }
}
