import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CanWriteDirective } from '../../../../core/directives/permission-write.directive';
import { AppUser } from '../../../../core/models/domain/app-user.model';
import { Employee } from '../../../../core/models/domain/employee.model';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import {
  EmployeeAdminService,
  EmployeeRemoval,
} from '../../../../core/services/employee-admin.service';
import { EmployeeExportService } from '../../../../core/services/employee-export.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { formatDate } from '../../../../core/utils/date.util';
import { hasHistory } from '../../../../core/utils/employee-history.util';
import {
  EMPLOYEE_PAGE_SIZES,
  EmployeeTableCriteria,
  buildEmployeeList,
  defaultEmployeeCriteria,
  employeeAddressLine,
  listLocations,
  paginateEmployees,
  parseCreatedDate,
  parseEmployeePageSize,
  parseEmployeeStatusFilter,
} from '../../../../core/utils/employee-list.util';
import { derivedEmployeeStatus } from '../../../../core/utils/leave-presence.util';
import { SEARCH_MAX_LENGTH } from '../../../../core/utils/product-list-filter.util';
import { EMPLOYEE_STATUS_DISPLAY } from '../../../../core/utils/status-display.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import {
  DataTableRowAction,
  DataTableRowActionEvent,
} from '../../../../shared/components/data-table/data-table-row-action.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';

const VIEW_ACTION: DataTableRowAction = { id: 'view', label: 'View', icon: 'eye' };
const EDIT_ACTION: DataTableRowAction = { id: 'edit', label: 'Edit', icon: 'edit' };
const DELETE_ACTION: DataTableRowAction = { id: 'delete', label: 'Delete', icon: 'trash' };

const NO_VALUE = '–';

@Component({
  selector: 'app-employee-list',
  imports: [
    ...FIELD_IMPORTS,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    CanWriteDirective,
    CardComponent,
    ConfirmDialogComponent,
    DataTableCellDirective,
    DataTableComponent,
    EmptyStateComponent,
    PaginationComponent,
  ],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.scss',
})
export class EmployeeListComponent {
  readonly employees = input.required<readonly Employee[]>();
  readonly users = input.required<readonly AppUser[]>();
  readonly onLeaveIds = input<ReadonlySet<string>>(new Set<string>());
  readonly changed = output<void>();

  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);
  private readonly adminService = inject(EmployeeAdminService);
  private readonly exportService = inject(EmployeeExportService);

  protected readonly moduleKey = ModuleKey.EMPLOYEES;
  protected readonly keywordMaxLength = SEARCH_MAX_LENGTH;
  protected readonly pageSizes = EMPLOYEE_PAGE_SIZES;

  protected readonly keyword = signal('');
  protected readonly location = signal('');
  protected readonly createdFrom = signal('');
  protected readonly createdTo = signal('');
  protected readonly status = signal(defaultEmployeeCriteria().status);
  private readonly applied = signal<EmployeeTableCriteria>(defaultEmployeeCriteria());
  protected readonly pageSize = signal<number>(EMPLOYEE_PAGE_SIZES[0]);
  protected readonly page = linkedSignal({
    source: () => ({ applied: this.applied(), pageSize: this.pageSize() }),
    computation: () => 1,
  });

  protected readonly pendingDelete = signal<Employee | null>(null);
  protected readonly deleting = signal(false);
  protected readonly exporting = signal(false);

  protected readonly canWrite = computed(() => this.permissionService.canWrite(this.moduleKey));
  protected readonly locations = computed(() => listLocations(this.employees()));
  protected readonly filtered = computed(() => buildEmployeeList(this.employees(), this.applied()));
  protected readonly pageData = computed(() =>
    paginateEmployees(this.filtered(), this.page(), this.pageSize())
  );
  protected readonly hasEmployees = computed(() => this.employees().length > 0);
  protected readonly actions = computed<readonly DataTableRowAction[]>(() =>
    this.canWrite() ? [VIEW_ACTION, EDIT_ACTION, DELETE_ACTION] : [VIEW_ACTION]
  );
  protected readonly deleteTitle = computed(() => {
    const target = this.pendingDelete();
    return target === null ? '' : `Delete ${target.name}?`;
  });
  protected readonly deleteMessage = computed(() => {
    const target = this.pendingDelete();
    if (target === null) return '';
    return hasHistory(target, this.users())
      ? `${target.name} (${target.code}) has a sign-in, so the record will be kept and marked Inactive.`
      : `${target.name} (${target.code}) will be removed from the list. You cannot undo this.`;
  });

  protected readonly columns: readonly DataTableColumn<Employee>[] = [
    { key: 'image', label: 'Image', value: employee => employee.name },
    { key: 'code', label: 'EMP Code', kind: 'code', value: employee => employee.code },
    { key: 'name', label: 'Name', value: employee => employee.name },
    { key: 'address', label: 'Address', value: employee => this.address(employee) },
    { key: 'phone', label: 'Mobile', value: employee => employee.phone },
    { key: 'email', label: 'Email', value: employee => employee.email || NO_VALUE },
    { key: 'dob', label: 'DOB', value: employee => this.dateOfBirth(employee) },
    { key: 'location', label: 'Location', value: employee => employee.location },
    { key: 'status', label: 'Status' },
  ];
  protected readonly rowKey = (employee: Employee): string => employee.id;
  protected readonly statusOf = (employee: Employee) =>
    EMPLOYEE_STATUS_DISPLAY[derivedEmployeeStatus(employee, this.onLeaveIds())];

  protected onKeyword(event: Event): void {
    this.keyword.set((event.target as HTMLInputElement).value.slice(0, SEARCH_MAX_LENGTH));
  }

  protected onLocation(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.location.set(this.locations().includes(value) ? value : '');
  }

  protected onCreatedFrom(event: Event): void {
    this.createdFrom.set(parseCreatedDate((event.target as HTMLInputElement).value));
  }

  protected onCreatedTo(event: Event): void {
    this.createdTo.set(parseCreatedDate((event.target as HTMLInputElement).value));
  }

  protected onStatus(event: Event): void {
    this.status.set(parseEmployeeStatusFilter((event.target as HTMLSelectElement).value));
  }

  protected onPageSize(event: Event): void {
    this.pageSize.set(parseEmployeePageSize(Number((event.target as HTMLSelectElement).value)));
  }

  protected applyFilters(event: Event): void {
    event.preventDefault();
    this.applied.set({
      keyword: this.keyword(),
      location: this.location(),
      createdFrom: this.createdFrom(),
      createdTo: this.createdTo(),
      status: this.status(),
    });
  }

  protected resetFilters(): void {
    const defaults = defaultEmployeeCriteria();
    this.keyword.set(defaults.keyword);
    this.location.set(defaults.location);
    this.createdFrom.set(defaults.createdFrom);
    this.createdTo.set(defaults.createdTo);
    this.status.set(defaults.status);
    this.applied.set(defaults);
  }

  protected addEmployee(): void {
    if (!this.canWrite()) return;
    this.router.navigate(['/employees', 'new']).catch(() => undefined);
  }

  protected onAction(event: DataTableRowActionEvent<Employee>): void {
    const id = event.row.id;
    if (event.actionId === 'view') {
      this.router.navigate(['/employees', id]).catch(() => undefined);
    } else if (event.actionId === 'edit' && this.canWrite()) {
      this.router.navigate(['/employees', id, 'edit']).catch(() => undefined);
    } else if (event.actionId === 'delete' && this.canWrite()) {
      this.pendingDelete.set(event.row);
    }
  }

  protected cancelDelete(): void {
    if (!this.deleting()) this.pendingDelete.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const target = this.pendingDelete();
    if (target === null || this.deleting()) return;
    this.deleting.set(true);
    try {
      this.announceRemoval(target, await this.adminService.remove(target.id));
    } finally {
      this.deleting.set(false);
      this.pendingDelete.set(null);
    }
    this.changed.emit();
  }

  protected exportCsv(): Promise<void> {
    return this.runExport(() => this.exportService.exportCsv(this.filtered()));
  }

  protected exportPdf(): Promise<void> {
    return this.runExport(() => this.exportService.exportPdf(this.filtered(), this.applied()));
  }

  protected address(employee: Employee): string {
    return employeeAddressLine(employee) || NO_VALUE;
  }

  protected dateOfBirth(employee: Employee): string {
    return employee.dateOfBirth === null ? NO_VALUE : formatDate(employee.dateOfBirth);
  }

  private announceRemoval(
    target: Employee,
    result: Awaited<ReturnType<EmployeeAdminService['remove']>>
  ): void {
    if (result.ok) {
      const removed = result.outcome === EmployeeRemoval.REMOVED;
      this.notificationService.show(
        removed ? 'success' : 'info',
        removed
          ? `${target.name} was removed.`
          : `${target.name} was kept and marked Inactive because they have history.`
      );
    } else if (result.reason === 'denied') {
      this.notificationService.show('warning', 'You do not have access to delete employees.');
    } else if (result.reason === 'busy') {
      this.notificationService.show('warning', 'Another change is still saving. Try again.');
    } else {
      this.notificationService.show('warning', `${target.name} is no longer in the list.`);
    }
  }

  private async runExport(run: () => Promise<unknown>): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      await run();
    } finally {
      this.exporting.set(false);
    }
  }
}
