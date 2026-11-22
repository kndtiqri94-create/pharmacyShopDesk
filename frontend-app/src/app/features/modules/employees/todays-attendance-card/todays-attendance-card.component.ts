import { Component, input, output } from '@angular/core';
import { CanWriteDirective } from '../../../../core/directives/permission-write.directive';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { AttendanceRow, formatTimeIn } from '../../../../core/utils/employee-list-filter.util';
import { ATTENDANCE_STATUS_DISPLAY } from '../../../../core/utils/status-display.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';

@Component({
  selector: 'app-todays-attendance-card',
  imports: [BadgeComponent, ButtonComponent, CanWriteDirective, CardComponent],
  templateUrl: './todays-attendance-card.component.html',
  styleUrl: './todays-attendance-card.component.scss',
})
export class TodaysAttendanceCardComponent {
  readonly rows = input.required<readonly AttendanceRow[]>();
  readonly markAttendance = output<void>();

  protected readonly employeesModule = ModuleKey.EMPLOYEES;
  protected readonly statusOf = (row: AttendanceRow) => ATTENDANCE_STATUS_DISPLAY[row.status];
  protected readonly formatTimeIn = formatTimeIn;
}
