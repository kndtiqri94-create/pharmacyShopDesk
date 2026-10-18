import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppUser } from '../../../../core/models/domain/app-user.model';
import { Employee } from '../../../../core/models/domain/employee.model';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { ClockService } from '../../../../core/services/clock.service';
import { EmployeeDataService } from '../../../../core/services/data/employee-data.service';
import { SettingsDataService } from '../../../../core/services/data/settings-data.service';
import { UserDataService } from '../../../../core/services/data/user-data.service';
import { EmployeeAdminService } from '../../../../core/services/employee-admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import {
  emptyEmployeeDraft,
  isDraftDirty,
  toDraft,
} from '../../../../core/utils/employee-diff.util';
import { hasLinkedUser } from '../../../../core/utils/employee-history.util';
import { listLocations } from '../../../../core/utils/employee-list.util';
import {
  EmployeeFieldErrors,
  EmployeeFormInput,
} from '../../../../core/utils/employee-validation.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { BreadcrumbItem } from '../../../../shared/components/breadcrumb/breadcrumb-item.model';
import { BreadcrumbComponent } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { EmployeeAddressSectionComponent } from './employee-address-section/employee-address-section.component';
import { EmployeeBasicSectionComponent } from './employee-basic-section/employee-basic-section.component';
import { EmployeeMoreSectionComponent } from './employee-more-section/employee-more-section.component';
import { EmployeeSalarySectionComponent } from './employee-salary-section/employee-salary-section.component';
import { EmployeeDraftPatch, employeeFieldId } from './employee-section.model';

export type EmployeeFormMode = 'create' | 'edit' | 'view';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const LIST_PATH = '/employees';
const FALLBACK_LOCATION = 'Main Shop';
const DRAFT_TO_ERROR_KEY: Record<string, string> = { photoDataUrl: 'photo' };

@Component({
  selector: 'app-employee-form',
  imports: [
    BadgeComponent,
    BreadcrumbComponent,
    ButtonComponent,
    CardComponent,
    ConfirmDialogComponent,
    EmployeeAddressSectionComponent,
    EmployeeBasicSectionComponent,
    EmployeeMoreSectionComponent,
    EmployeeSalarySectionComponent,
    EmptyStateComponent,
    PageHeaderComponent,
  ],
  templateUrl: './employee-form.component.html',
  styleUrl: './employee-form.component.scss',
})
export class EmployeeFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly clockService = inject(ClockService);
  private readonly employeeDataService = inject(EmployeeDataService);
  private readonly userDataService = inject(UserDataService);
  private readonly settingsDataService = inject(SettingsDataService);
  private readonly employeeAdminService = inject(EmployeeAdminService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);

  protected readonly mode: EmployeeFormMode = this.route.snapshot.data['mode'] ?? 'create';
  protected readonly today = this.clockService.today();

  protected readonly loaded = signal(false);
  protected readonly notFound = signal(false);
  protected readonly saving = signal(false);
  protected readonly leaveConfirmOpen = signal(false);
  protected readonly reminderOpen = signal(false);
  protected readonly errors = signal<EmployeeFieldErrors>({});
  protected readonly draft = signal<EmployeeFormInput>(emptyEmployeeDraft(FALLBACK_LOCATION));
  protected readonly baseline = signal<EmployeeFormInput>(emptyEmployeeDraft(FALLBACK_LOCATION));
  protected readonly existing = signal<Employee | null>(null);
  protected readonly linkedUser = signal(false);
  protected readonly locations = signal<readonly string[]>([FALLBACK_LOCATION]);
  protected readonly savedEmployeeId = signal<string | null>(null);

  protected readonly readOnly = computed(
    () => this.mode === 'view' || !this.permissionService.canWrite(ModuleKey.EMPLOYEES)
  );
  protected readonly dirty = computed(() => isDraftDirty(this.draft(), this.baseline()));
  protected readonly title = computed(() => {
    if (this.notFound()) return 'Employee not found';
    if (this.mode === 'create') return 'Add employee';
    const employee = this.existing();
    if (this.mode === 'view') return employee?.name ?? 'Employee';
    return 'Edit employee';
  });
  protected readonly subtitle = computed(() => {
    if (this.notFound()) return 'We could not find that employee.';
    if (this.mode === 'create') return 'Fill in their details. Fields marked * are required.';
    if (this.readOnly()) return 'You can look at this employee but you cannot change them.';
    return `${this.existing()?.name ?? 'This employee'} · Fields marked * are required.`;
  });
  protected readonly breadcrumb = computed<readonly BreadcrumbItem[]>(() => [
    { label: 'Employees', link: LIST_PATH },
    { label: this.title() },
  ]);
  protected readonly canViewSalary = computed(() =>
    this.permissionService.canView(ModuleKey.EMPLOYEES)
  );
  protected readonly canOpenUsers = computed(() => this.permissionService.canView(ModuleKey.USERS));

  ngOnInit(): void {
    if (this.mode !== 'view' && !this.permissionService.canWrite(ModuleKey.EMPLOYEES)) {
      this.goToList();
      return;
    }
    this.initialize().catch(() => this.notFound.set(true));
  }

  protected updateDraft(patch: EmployeeDraftPatch): void {
    if (this.readOnly()) return;
    this.draft.update(current => ({ ...current, ...patch }));
    const cleared = Object.keys(patch).map(key => DRAFT_TO_ERROR_KEY[key] ?? key);
    this.errors.update(current => {
      const next = { ...current };
      for (const key of cleared) delete next[key];
      return next;
    });
  }

  protected cancel(): void {
    if (!this.readOnly() && this.dirty()) {
      this.leaveConfirmOpen.set(true);
      return;
    }
    this.goToList();
  }

  protected keepEditing(): void {
    this.leaveConfirmOpen.set(false);
  }

  protected discardAndLeave(): void {
    this.leaveConfirmOpen.set(false);
    this.goToList();
  }

  protected goToList(): void {
    this.router.navigate([LIST_PATH]).catch(() => undefined);
  }

  protected goToEdit(): void {
    const id = this.existing()?.id;
    if (id !== undefined) this.router.navigate([LIST_PATH, id, 'edit']).catch(() => undefined);
  }

  protected save(): void {
    this.submit().catch(() => this.saving.set(false));
  }

  protected goToUsers(): void {
    const employeeId = this.savedEmployeeId();
    this.reminderOpen.set(false);
    this.router.navigate(['/users'], { queryParams: { employeeId } }).catch(() => undefined);
  }

  protected skipUsers(): void {
    this.reminderOpen.set(false);
    this.goToList();
  }

  private async initialize(): Promise<void> {
    const [employees, users, settings] = await Promise.all([
      firstValueFrom(this.employeeDataService.getAll()),
      firstValueFrom(this.userDataService.getAll()),
      firstValueFrom(this.settingsDataService.get()),
    ]);
    const shopLocation = settings.branchLabel.trim() || FALLBACK_LOCATION;
    this.locations.set(Array.from(new Set([shopLocation, ...listLocations(employees)])));
    if (this.mode === 'create') {
      this.begin(emptyEmployeeDraft(shopLocation));
    } else {
      this.openExisting(employees, users);
    }
    this.loaded.set(true);
  }

  private openExisting(employees: readonly Employee[], users: readonly AppUser[]): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const employee = ID_PATTERN.test(id)
      ? employees.find(candidate => candidate.id === id)
      : undefined;
    if (employee === undefined) {
      this.notFound.set(true);
      return;
    }
    const linked = hasLinkedUser(employee, users);
    this.existing.set(employee);
    this.linkedUser.set(linked);
    this.begin({ ...toDraft(employee), createUserAccount: linked || employee.createUserAccount });
  }

  private begin(input: EmployeeFormInput): void {
    this.draft.set(input);
    this.baseline.set(input);
    this.errors.set({});
  }

  private async submit(): Promise<void> {
    if (this.readOnly() || this.saving()) return;
    this.saving.set(true);
    const input = this.draft();
    const existingId = this.existing()?.id ?? null;
    const result =
      existingId === null
        ? await this.employeeAdminService.create(input)
        : await this.employeeAdminService.update(existingId, input);
    this.saving.set(false);
    if (result.ok) {
      this.finishSave(result.employee);
      return;
    }
    if (result.reason === 'not-found') {
      this.notFound.set(true);
    } else if (result.reason === 'denied') {
      this.notificationService.show('warning', 'You do not have permission to change employees.');
    } else if (result.reason === 'invalid') {
      this.errors.set(result.errors);
      this.focusField(result.firstErrorField);
    }
  }

  private finishSave(employee: Employee): void {
    const needsReminder =
      employee.createUserAccount && employee.userId === null && !this.baseline().createUserAccount;
    this.baseline.set(this.draft());
    if (!needsReminder) {
      this.notificationService.show('success', `${employee.name} was saved.`);
      this.goToList();
      return;
    }
    if (!this.canOpenUsers()) {
      this.notificationService.show(
        'success',
        `${employee.name} was saved. Ask an Admin to finish creating their user account in Users & roles.`
      );
      this.goToList();
      return;
    }
    this.notificationService.show(
      'success',
      `${employee.name} was saved. Finish creating their user account in Users & roles.`
    );
    this.savedEmployeeId.set(employee.id);
    this.reminderOpen.set(true);
  }

  private focusField(key: string | null): void {
    if (key === null) return;
    this.hostElement.nativeElement.querySelector<HTMLElement>(`#${employeeFieldId(key)}`)?.focus();
  }
}
