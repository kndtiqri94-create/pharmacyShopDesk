import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CanWriteDirective } from '../../../core/directives/permission-write.directive';
import { AppUser } from '../../../core/models/domain/app-user.model';
import { AttendanceRecord } from '../../../core/models/domain/attendance-record.model';
import { Employee } from '../../../core/models/domain/employee.model';
import { LeaveRecord } from '../../../core/models/domain/leave-record.model';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { AttendanceDataService } from '../../../core/services/data/attendance-data.service';
import { EmployeeDataService } from '../../../core/services/data/employee-data.service';
import { LeaveDataService } from '../../../core/services/data/leave-data.service';
import { UserDataService } from '../../../core/services/data/user-data.service';
import { ClockService } from '../../../core/services/clock.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  buildAttendanceRows,
  buildLeaveRows,
  formatEmployeeSubtitle,
  summarizeEmployees,
  toEmployeeListItems,
} from '../../../core/utils/employee-list-filter.util';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { TabItem } from '../../../shared/components/tabs/tab-item.model';
import { TabsComponent } from '../../../shared/components/tabs/tabs.component';
import { AttendanceTableComponent } from './attendance-table/attendance-table.component';
import { EmployeeTilesComponent } from './employee-tiles/employee-tiles.component';
import { LeaveTableComponent } from './leave-table/leave-table.component';
import { StaffTableComponent } from './staff-table/staff-table.component';
import { TodaysAttendanceCardComponent } from './todays-attendance-card/todays-attendance-card.component';

type EmployeeTab = 'staff' | 'attendance' | 'leave';

interface EmployeePageData {
  employees: readonly Employee[];
  users: readonly AppUser[];
  attendance: readonly AttendanceRecord[];
  leave: readonly LeaveRecord[];
}

const TAB_IDS: readonly EmployeeTab[] = ['staff', 'attendance', 'leave'];
const TAB_PANEL_ID = 'employees-tab-panel';

@Component({
  selector: 'app-employees',
  imports: [
    AttendanceTableComponent,
    ButtonComponent,
    CanWriteDirective,
    EmployeeTilesComponent,
    LeaveTableComponent,
    PageHeaderComponent,
    StaffTableComponent,
    TabsComponent,
    TodaysAttendanceCardComponent,
  ],
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.scss',
})
export class EmployeesComponent implements OnInit {
  private readonly clockService = inject(ClockService);
  private readonly notificationService = inject(NotificationService);
  private readonly employeeDataService = inject(EmployeeDataService);
  private readonly userDataService = inject(UserDataService);
  private readonly attendanceDataService = inject(AttendanceDataService);
  private readonly leaveDataService = inject(LeaveDataService);

  protected readonly moduleKey = ModuleKey.EMPLOYEES;
  protected readonly panelId = TAB_PANEL_ID;
  protected readonly tab = signal<EmployeeTab>('staff');

  private readonly data = signal<EmployeePageData | null>(null);

  protected readonly items = computed(() => {
    const data = this.data();
    return data ? toEmployeeListItems(data.employees, data.users) : [];
  });
  protected readonly attendanceRows = computed(() => {
    const data = this.data();
    return data ? buildAttendanceRows(data.employees, data.attendance) : [];
  });
  protected readonly leaveRows = computed(() => {
    const data = this.data();
    return data ? buildLeaveRows(data.employees, data.leave) : [];
  });
  protected readonly summary = computed(() => {
    const data = this.data();
    return data
      ? summarizeEmployees(data.employees, data.users, this.attendanceRows(), this.leaveRows())
      : null;
  });
  protected readonly subtitle = computed(() => {
    const summary = this.summary();
    return summary ? formatEmployeeSubtitle(summary) : '';
  });
  protected readonly tabItems = computed<readonly TabItem[]>(() => [
    { id: 'staff', label: 'Staff', count: this.items().length },
    { id: 'attendance', label: 'Attendance' },
    { id: 'leave', label: 'Leave', count: this.leaveRows().length },
  ]);

  ngOnInit(): void {
    this.load().catch(() => undefined);
  }

  protected setTab(value: string): void {
    const chosen = TAB_IDS.find(id => id === value);
    if (chosen !== undefined) this.tab.set(chosen);
  }

  protected showSampleMessage(feature: string): void {
    this.notificationService.showSampleOnly(feature);
  }

  private async load(): Promise<void> {
    const [employees, users, attendance, leave] = await Promise.all([
      firstValueFrom(this.employeeDataService.getAll()),
      firstValueFrom(this.userDataService.getAll()),
      firstValueFrom(this.attendanceDataService.getForDate(this.clockService.today())),
      firstValueFrom(this.leaveDataService.getAll()),
    ]);
    this.data.set({ employees, users, attendance, leave });
  }
}
