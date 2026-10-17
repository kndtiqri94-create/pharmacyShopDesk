import { Component, input } from '@angular/core';
import { formatDate } from '../../../../core/utils/date.util';
import { LeaveRow } from '../../../../core/utils/employee-list-filter.util';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-leave-table',
  imports: [CardComponent, DataTableComponent],
  templateUrl: './leave-table.component.html',
})
export class LeaveTableComponent {
  readonly rows = input.required<readonly LeaveRow[]>();

  protected readonly columns: readonly DataTableColumn<LeaveRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      value: row => row.employee.name,
      subValue: row => row.employee.code,
    },
    { key: 'role', label: 'Role', value: row => row.employee.jobTitle },
    {
      key: 'returns',
      label: 'Returns',
      value: row => (row.returnDate === null ? '–' : formatDate(row.returnDate)),
    },
  ];
  protected readonly rowKey = (row: LeaveRow): string => row.employee.id;
}
