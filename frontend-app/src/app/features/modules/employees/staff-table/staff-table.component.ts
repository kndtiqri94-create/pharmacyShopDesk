import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { PermissionService } from '../../../../core/services/permission.service';
import {
  EmployeeFilter,
  EmployeeListItem,
  SEARCH_MAX_LENGTH,
  countEmployeeFilters,
  filterEmployeeItems,
  formatLoginBadge,
  parseEmployeeFilter,
} from '../../../../core/utils/employee-list-filter.util';
import { EMPLOYEE_STATUS_DISPLAY } from '../../../../core/utils/status-display.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ChipItem } from '../../../../shared/components/chips/chip-item.model';
import { ChipsComponent } from '../../../../shared/components/chips/chips.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import {
  DataTableRowAction,
  DataTableRowActionEvent,
} from '../../../../shared/components/data-table/data-table-row-action.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

const FILTER_CHIPS: readonly { id: EmployeeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'on-leave', label: 'On leave' },
];

const VIEW_ACTION: DataTableRowAction = { id: 'view', label: 'View', icon: 'eye' };
const EDIT_ACTION: DataTableRowAction = { id: 'edit', label: 'Edit', icon: 'edit' };
const MORE_ACTION: DataTableRowAction = { id: 'more', label: 'More options for', icon: 'more' };

const ACTION_FEATURES: Record<string, string> = {
  view: 'View employee',
  edit: 'Edit employee',
  more: 'More actions',
};

@Component({
  selector: 'app-staff-table',
  imports: [
    AvatarComponent,
    BadgeComponent,
    CardComponent,
    ChipsComponent,
    DataTableCellDirective,
    DataTableComponent,
    IconComponent,
  ],
  templateUrl: './staff-table.component.html',
  styleUrl: './staff-table.component.scss',
})
export class StaffTableComponent {
  readonly items = input.required<readonly EmployeeListItem[]>();
  readonly actionChosen = output<string>();

  private readonly permissionService = inject(PermissionService);

  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;
  protected readonly search = signal('');
  protected readonly filter = signal<EmployeeFilter>('all');
  protected readonly page = linkedSignal({
    source: () => ({ search: this.search(), filter: this.filter() }),
    computation: () => 1,
  });
  protected readonly rows = computed(() =>
    filterEmployeeItems(this.items(), { search: this.search(), filter: this.filter() })
  );
  protected readonly chipItems = computed<readonly ChipItem[]>(() => {
    const counts = countEmployeeFilters(this.items(), this.search());
    return FILTER_CHIPS.map(chip => ({ ...chip, count: counts[chip.id] }));
  });
  protected readonly actions = computed<readonly DataTableRowAction[]>(() =>
    this.permissionService.canWrite(ModuleKey.EMPLOYEES)
      ? [VIEW_ACTION, EDIT_ACTION, MORE_ACTION]
      : [VIEW_ACTION]
  );

  protected readonly columns: readonly DataTableColumn<EmployeeListItem>[] = [
    { key: 'employee', label: 'Employee', value: item => item.employee.name },
    { key: 'role', label: 'Role', value: item => item.employee.jobTitle },
    { key: 'phone', label: 'Phone', value: item => item.employee.phone },
    { key: 'shift', label: 'Shift', value: item => item.employee.shift },
    { key: 'login', label: 'System login' },
    { key: 'status', label: 'Status' },
  ];
  protected readonly rowKey = (item: EmployeeListItem): string => item.employee.id;
  protected readonly statusOf = (item: EmployeeListItem) =>
    EMPLOYEE_STATUS_DISPLAY[item.employee.status];
  protected readonly loginLabel = (item: EmployeeListItem) => formatLoginBadge(item.login);

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.slice(0, SEARCH_MAX_LENGTH));
  }

  protected setFilter(value: string): void {
    this.filter.set(parseEmployeeFilter(value));
  }

  protected onAction(event: DataTableRowActionEvent<EmployeeListItem>): void {
    this.actionChosen.emit(ACTION_FEATURES[event.actionId] ?? 'This action');
  }
}
