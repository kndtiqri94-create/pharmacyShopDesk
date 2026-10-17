import { Component, input } from '@angular/core';
import { AttendanceRow, formatTimeIn } from '../../../../core/utils/employee-list-filter.util';
import { ATTENDANCE_STATUS_DISPLAY } from '../../../../core/utils/status-display.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-attendance-table',
  imports: [BadgeComponent, CardComponent, DataTableCellDirective, DataTableComponent],
  templateUrl: './attendance-table.component.html',
})
export class AttendanceTableComponent {
  readonly rows = input.required<readonly AttendanceRow[]>();

  protected readonly columns: readonly DataTableColumn<AttendanceRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      value: row => row.employee.name,
      subValue: row => row.employee.code,
    },
    { key: 'status', label: 'Status' },
    { key: 'timeIn', label: 'Time in', value: row => formatTimeIn(row.timeIn) },
  ];
  protected readonly rowKey = (row: AttendanceRow): string => row.employee.id;
  protected readonly statusOf = (row: AttendanceRow) => ATTENDANCE_STATUS_DISPLAY[row.status];
}
