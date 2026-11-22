import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppUser } from '../../../../core/models/domain/app-user.model';
import { Employee } from '../../../../core/models/domain/employee.model';
import { LeaveEntitlement } from '../../../../core/models/domain/leave-entitlement.model';
import { LeaveRequest } from '../../../../core/models/domain/leave-request.model';
import { LeaveType } from '../../../../core/models/domain/leave-type.model';
import { LeaveReason } from '../../../../core/models/enums/leave-reason.enum';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { ClockService } from '../../../../core/services/clock.service';
import { EmployeeDataService } from '../../../../core/services/data/employee-data.service';
import { LeaveDataService } from '../../../../core/services/data/leave-data.service';
import { UserDataService } from '../../../../core/services/data/user-data.service';
import { LeaveAdminService } from '../../../../core/services/leave-admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { buildBalanceRows, formatLeaveDays } from '../../../../core/utils/leave-balance.util';
import {
  coveringLeaveWarning,
  employeeOptionLabel,
} from '../../../../core/utils/leave-covering.util';
import {
  countLeaveDays,
  leavePeriodText,
  leaveYearBounds,
  leaveYearChoices,
  isInsideLeaveYear,
} from '../../../../core/utils/leave-days.util';
import {
  draftAfterApply,
  emptyLeaveDraft,
  isLeaveDraftDirty,
} from '../../../../core/utils/leave-draft.util';
import {
  LEAVE_COMMENTS_MAX,
  LeaveFieldErrors,
  LeaveFormInput,
  isActiveEmployee,
  isEligibleApprover,
  isLeaveTypeSelectable,
} from '../../../../core/utils/leave-validation.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { BreadcrumbItem } from '../../../../shared/components/breadcrumb/breadcrumb-item.model';
import { BreadcrumbComponent } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CoveringEmployeePickerComponent } from './covering-employee-picker/covering-employee-picker.component';
import { LeaveAttachmentFieldComponent } from './leave-attachment-field/leave-attachment-field.component';
import { eventValue, leaveFieldId } from './leave-application.model';
import { LeaveBalanceCardComponent } from './leave-balance-card/leave-balance-card.component';

type ConfirmKind = 'reset' | 'leave' | null;

const LIST_PATH = '/employees';

@Component({
  selector: 'app-leave-application',
  imports: [
    ...FIELD_IMPORTS,
    AlertComponent,
    BreadcrumbComponent,
    ButtonComponent,
    CardComponent,
    ConfirmDialogComponent,
    CoveringEmployeePickerComponent,
    EmptyStateComponent,
    LeaveAttachmentFieldComponent,
    LeaveBalanceCardComponent,
    PageHeaderComponent,
  ],
  templateUrl: './leave-application.component.html',
  styleUrl: './leave-application.component.scss',
})
export class LeaveApplicationComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly clockService = inject(ClockService);
  private readonly employeeDataService = inject(EmployeeDataService);
  private readonly userDataService = inject(UserDataService);
  private readonly leaveDataService = inject(LeaveDataService);
  private readonly leaveAdminService = inject(LeaveAdminService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);

  private readonly currentYear = leaveYearChoices(this.clockService.today())[1];

  protected readonly yearChoices = leaveYearChoices(this.clockService.today());
  protected readonly reasons: readonly string[] = Object.values(LeaveReason);
  protected readonly commentsMax = LEAVE_COMMENTS_MAX;
  protected readonly fieldId = leaveFieldId;
  protected readonly valueOf = eventValue;
  protected readonly optionLabel = employeeOptionLabel;
  protected readonly breadcrumb: readonly BreadcrumbItem[] = [
    { label: 'Employees', link: LIST_PATH },
    { label: 'Apply for leave' },
  ];

  protected readonly loaded = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirm = signal<ConfirmKind>(null);
  protected readonly errors = signal<LeaveFieldErrors>({});
  protected readonly draft = signal<LeaveFormInput>(emptyLeaveDraft(this.currentYear));
  protected readonly baseline = signal<LeaveFormInput>(emptyLeaveDraft(this.currentYear));
  protected readonly employees = signal<readonly Employee[]>([]);
  protected readonly users = signal<readonly AppUser[]>([]);
  protected readonly types = signal<readonly LeaveType[]>([]);
  protected readonly entitlements = signal<readonly LeaveEntitlement[]>([]);
  protected readonly requests = signal<readonly LeaveRequest[]>([]);

  protected readonly dirty = computed(() => isLeaveDraftDirty(this.draft(), this.baseline()));
  protected readonly periodText = computed(() => leavePeriodText(this.draft().year));
  protected readonly bounds = computed(() => leaveYearBounds(this.draft().year));
  protected readonly activeEmployees = computed(() => this.employees().filter(isActiveEmployee));
  protected readonly approvers = computed(() =>
    this.employees().filter(
      employee =>
        employee.id !== this.draft().employeeId && isEligibleApprover(employee, this.users())
    )
  );
  protected readonly daysRequested = computed(() => {
    const { fromDate, toDate } = this.draft();
    const days = countLeaveDays(fromDate, toDate);
    return Number.isNaN(days) || days < 1 ? null : `${formatLeaveDays(days)} days`;
  });
  protected readonly emptyMessage = computed(() => {
    const noEmployees = this.activeEmployees().length === 0;
    const noTypes = this.types().length === 0;
    if (noEmployees && noTypes) {
      return 'There are no active employees and no leave types yet. Add them first, then come back to apply for leave.';
    }
    if (noEmployees) {
      return 'There are no active employees to choose. Add or activate an employee first, then come back to apply for leave.';
    }
    return noTypes
      ? 'There are no leave types set up yet. Add a leave type first, then come back to apply for leave.'
      : null;
  });
  protected readonly balanceRows = computed(() => {
    const draft = this.draft();
    return draft.employeeId === ''
      ? []
      : buildBalanceRows(
          draft.employeeId,
          draft.year,
          this.types(),
          this.entitlements(),
          this.requests()
        );
  });
  protected readonly coveringWarning = computed(() => {
    const draft = this.draft();
    return coveringLeaveWarning(
      draft.coveringEmployeeId,
      draft.fromDate,
      draft.toDate,
      this.employees(),
      this.requests()
    );
  });
  protected readonly confirmTitle = computed(() =>
    this.confirm() === 'leave' ? 'Leave without applying?' : 'Clear the form?'
  );
  protected readonly confirmLabel = computed(() =>
    this.confirm() === 'leave' ? 'Leave without applying' : 'Clear form'
  );
  protected readonly confirmCancelLabel = computed(() =>
    this.confirm() === 'leave' ? 'Keep editing' : 'Keep what I typed'
  );

  ngOnInit(): void {
    if (!this.permissionService.canWrite(ModuleKey.EMPLOYEES)) {
      this.goToList();
      return;
    }
    this.initialize().catch(() => this.loadFailed.set(true));
  }

  protected error(key: string): string | null {
    return this.errors()[key] ?? null;
  }

  protected typeSelectable(typeId: string): boolean {
    const draft = this.draft();
    return (
      draft.employeeId === '' ||
      isLeaveTypeSelectable(draft.employeeId, typeId, draft.year, {
        entitlements: this.entitlements(),
        requests: this.requests(),
      })
    );
  }

  protected update(patch: Partial<LeaveFormInput>): void {
    this.draft.update(current => this.tidy({ ...current, ...patch }));
    const cleared = new Set(Object.keys(patch));
    if (cleared.has('employeeId') || cleared.has('year')) {
      cleared.add('leaveTypeId');
      cleared.add('fromDate');
      cleared.add('toDate');
    }
    if (cleared.has('fromDate') || cleared.has('toDate') || cleared.has('leaveTypeId')) {
      cleared.add('fromDate');
      cleared.add('toDate');
    }
    this.errors.update(current => {
      const next = { ...current };
      for (const key of cleared) delete next[key];
      return next;
    });
  }

  protected apply(): void {
    this.submit().catch(() => this.saving.set(false));
  }

  protected reset(): void {
    if (this.dirty()) {
      this.confirm.set('reset');
      return;
    }
    this.clearForm();
  }

  protected back(): void {
    if (this.dirty()) {
      this.confirm.set('leave');
      return;
    }
    this.goToList();
  }

  protected confirmed(): void {
    const kind = this.confirm();
    this.confirm.set(null);
    if (kind === 'leave') this.goToList();
    if (kind === 'reset') this.clearForm();
  }

  protected keepEditing(): void {
    this.confirm.set(null);
  }

  private tidy(next: LeaveFormInput): LeaveFormInput {
    let result = next;
    if (result.employeeId !== '' && result.approverEmployeeId === result.employeeId) {
      result = { ...result, approverEmployeeId: '' };
    }
    if (result.employeeId !== '' && result.coveringEmployeeId === result.employeeId) {
      result = { ...result, coveringEmployeeId: '' };
    }
    if (result.fromDate !== '' && !isInsideLeaveYear(result.fromDate, result.year)) {
      result = { ...result, fromDate: '' };
    }
    if (result.toDate !== '' && !isInsideLeaveYear(result.toDate, result.year)) {
      result = { ...result, toDate: '' };
    }
    if (
      result.leaveTypeId !== '' &&
      !isLeaveTypeSelectable(result.employeeId, result.leaveTypeId, result.year, {
        entitlements: this.entitlements(),
        requests: this.requests(),
      }) &&
      result.employeeId !== ''
    ) {
      result = { ...result, leaveTypeId: '' };
    }
    return result;
  }

  private goToList(): void {
    this.router.navigate([LIST_PATH]).catch(() => undefined);
  }

  private clearForm(): void {
    const fresh = emptyLeaveDraft(this.currentYear);
    this.draft.set(fresh);
    this.baseline.set(fresh);
    this.errors.set({});
  }

  private async initialize(): Promise<void> {
    await this.loadData();
    this.loaded.set(true);
  }

  private async loadData(): Promise<void> {
    const [employees, users, types, entitlements, requests] = await Promise.all([
      firstValueFrom(this.employeeDataService.getAll()),
      firstValueFrom(this.userDataService.getAll()),
      firstValueFrom(this.leaveDataService.getTypes()),
      firstValueFrom(this.leaveDataService.getEntitlements()),
      firstValueFrom(this.leaveDataService.getRequests()),
    ]);
    this.employees.set(employees);
    this.users.set(users);
    this.types.set(types);
    this.entitlements.set(entitlements);
    this.requests.set(requests);
  }

  private async submit(): Promise<void> {
    if (this.saving() || !this.permissionService.canWrite(ModuleKey.EMPLOYEES)) return;
    this.saving.set(true);
    const input = this.draft();
    const result = await this.leaveAdminService.apply(input);
    this.saving.set(false);
    if (result.ok) {
      await this.finishApply(input);
      return;
    }
    if (result.reason === 'invalid') {
      this.errors.set(result.errors);
      this.focusField(result.firstErrorField);
    } else if (result.reason === 'denied') {
      this.notificationService.show('warning', 'You do not have permission to apply for leave.');
    } else if (result.reason !== 'busy') {
      this.notificationService.show('warning', 'That leave could not be sent. Try again.');
    }
  }

  private async finishApply(input: LeaveFormInput): Promise<void> {
    const name =
      this.employees().find(item => item.id === input.employeeId)?.name ?? 'the employee';
    const next = draftAfterApply(input);
    this.draft.set(next);
    this.baseline.set(next);
    this.errors.set({});
    this.notificationService.show('success', `Leave for ${name} was sent for approval.`);
    await this.loadData().catch(() => this.loadFailed.set(true));
  }

  private focusField(key: string | null): void {
    if (key === null) return;
    this.hostElement.nativeElement.querySelector<HTMLElement>(`#${leaveFieldId(key)}`)?.focus();
  }
}
