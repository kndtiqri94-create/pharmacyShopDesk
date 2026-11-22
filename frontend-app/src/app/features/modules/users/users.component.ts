import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CanWriteDirective } from '../../../core/directives/permission-write.directive';
import { AppUser } from '../../../core/models/domain/app-user.model';
import { Employee } from '../../../core/models/domain/employee.model';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { UserStatus } from '../../../core/models/enums/user-status.enum';
import { AuthService } from '../../../core/services/auth/auth.service';
import { EmployeeDataService } from '../../../core/services/data/employee-data.service';
import { UserDataService } from '../../../core/services/data/user-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { UserAdminService } from '../../../core/services/user-admin.service';
import { UserRow, buildUserRows } from '../../../core/utils/user-list.util';
import { formatUserRoleLabel } from '../../../core/utils/user-role-label.util';
import { availableEmployees } from '../../../core/utils/user-validation.util';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AddUserPanelComponent } from './add-user-panel/add-user-panel.component';
import { EditRolesPanelComponent } from './edit-roles-panel/edit-roles-panel.component';
import { EditUserPanelComponent } from './edit-user-panel/edit-user-panel.component';
import { RolePermissionsCardComponent } from './role-permissions-card/role-permissions-card.component';
import { UsersCardComponent } from './users-card/users-card.component';

@Component({
  selector: 'app-users',
  imports: [
    AddUserPanelComponent,
    ButtonComponent,
    CanWriteDirective,
    ConfirmDialogComponent,
    EditRolesPanelComponent,
    EditUserPanelComponent,
    PageHeaderComponent,
    RolePermissionsCardComponent,
    UsersCardComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly userAdminService = inject(UserAdminService);
  private readonly userDataService = inject(UserDataService);
  private readonly employeeDataService = inject(EmployeeDataService);

  protected readonly moduleKey = ModuleKey.USERS;
  protected readonly addOpen = signal(false);
  protected readonly rolesOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly lockingId = signal<string | null>(null);
  protected readonly lockBusy = signal(false);
  protected readonly preselectedEmployeeId = signal<string | null>(null);
  private requestHandled = false;

  private readonly users = signal<readonly AppUser[]>([]);
  private readonly employees = signal<readonly Employee[]>([]);

  protected readonly matrix = this.permissionService.matrix;
  protected readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);
  protected readonly canEdit = computed(() => this.permissionService.canWrite(this.moduleKey));
  protected readonly rows = computed(() => buildUserRows(this.users(), this.employees()));
  protected readonly unlinkedEmployees = computed(() =>
    availableEmployees(this.employees(), this.users())
  );
  protected readonly editingRow = computed(() => this.findRow(this.editingId()));
  protected readonly lockingRow = computed(() => this.findRow(this.lockingId()));

  ngOnInit(): void {
    this.load().catch(() => undefined);
  }

  protected onCreated(user: AppUser): void {
    this.addOpen.set(false);
    this.notificationService.show(
      'success',
      `${user.displayName} can now sign in as ${formatUserRoleLabel(user.role)}.`
    );
    this.load().catch(() => undefined);
  }

  protected onRoleSaved(user: AppUser): void {
    this.editingId.set(null);
    this.notificationService.show(
      'success',
      `${user.displayName} is now ${formatUserRoleLabel(user.role)}.`
    );
    this.load().catch(() => undefined);
  }

  protected onRolesSaved(): void {
    this.rolesOpen.set(false);
    this.notificationService.show(
      'success',
      'Permissions saved. They apply straight away, without signing in again.'
    );
  }

  protected toggleLock(row: UserRow): void {
    if (row.user.id === this.currentUserId()) return;
    if (row.user.status === UserStatus.ACTIVE) {
      this.lockingId.set(row.user.id);
      return;
    }
    this.changeStatus(row.user, false).catch(() => undefined);
  }

  protected confirmDisable(): void {
    const row = this.lockingRow();
    if (row === null || this.lockBusy()) return;
    this.lockBusy.set(true);
    this.changeStatus(row.user, true)
      .catch(() => undefined)
      .finally(() => {
        this.lockBusy.set(false);
        this.lockingId.set(null);
      });
  }

  protected cancelDisable(): void {
    if (!this.lockBusy()) this.lockingId.set(null);
  }

  private async changeStatus(user: AppUser, disabled: boolean): Promise<void> {
    const result = await this.userAdminService.setDisabled(user.id, disabled);
    if (result.ok) {
      this.notificationService.show(
        'success',
        disabled
          ? `${user.displayName} can no longer sign in. Their history is kept.`
          : `${user.displayName} can sign in again.`
      );
      await this.load();
      return;
    }
    this.notificationService.show(
      'warning',
      result.reason === 'own-account'
        ? 'You cannot disable your own sign-in.'
        : 'That change was not made. You may not have access to change users.'
    );
  }

  private findRow(userId: string | null): UserRow | null {
    return this.rows().find(row => row.user.id === userId) ?? null;
  }

  private async load(): Promise<void> {
    const [users, employees] = await Promise.all([
      firstValueFrom(this.userDataService.getAll()),
      firstValueFrom(this.employeeDataService.getAll()),
    ]);
    this.users.set(users);
    this.employees.set(employees);
    this.openForRequestedEmployee();
  }

  private openForRequestedEmployee(): void {
    if (this.requestHandled) return;
    this.requestHandled = true;
    const requested = this.route.snapshot.queryParamMap.get('employeeId');
    if (requested === null || !this.canEdit()) return;
    if (this.unlinkedEmployees().some(employee => employee.id === requested)) {
      this.preselectedEmployeeId.set(requested);
      this.addOpen.set(true);
    }
  }
}
