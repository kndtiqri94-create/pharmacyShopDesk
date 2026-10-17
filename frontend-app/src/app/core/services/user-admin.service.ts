import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppUser } from '../models/domain/app-user.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { nextRecordId } from '../utils/document-number.util';
import { initialsFromName } from '../utils/initials.util';
import {
  UserFieldErrors,
  UserFormInput,
  isUserRole,
  validateUser,
} from '../utils/user-validation.util';
import { AuthService } from './auth/auth.service';
import { SessionCredentialStore } from './auth/session-credential-store.service';
import { EmployeeDataService } from './data/employee-data.service';
import { UserDataService } from './data/user-data.service';
import { PermissionService } from './permission.service';

export type UserAdminFailure = 'denied' | 'not-found' | 'own-account' | 'invalid';

export type CreateUserResult =
  | { ok: true; user: AppUser }
  | {
      ok: false;
      reason: UserAdminFailure;
      errors: UserFieldErrors;
      firstErrorField: string | null;
    };

export type UpdateUserResult =
  { ok: true; user: AppUser } | { ok: false; reason: UserAdminFailure };

const NO_ERRORS: UserFieldErrors = {};

@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly userDataService = inject(UserDataService);
  private readonly employeeDataService = inject(EmployeeDataService);
  private readonly sessionCredentialStore = inject(SessionCredentialStore);

  private creating = false;

  async createUser(input: UserFormInput): Promise<CreateUserResult> {
    if (!this.canAdminister() || (input.role === UserRole.ADMIN && !this.actingAsAdmin())) {
      return { ok: false, reason: 'denied', errors: NO_ERRORS, firstErrorField: null };
    }
    if (this.creating) {
      return { ok: false, reason: 'denied', errors: NO_ERRORS, firstErrorField: null };
    }
    this.creating = true;
    try {
      return await this.create(input);
    } finally {
      this.creating = false;
    }
  }

  private async create(input: UserFormInput): Promise<CreateUserResult> {
    const [employees, users] = await Promise.all([
      firstValueFrom(this.employeeDataService.getAll()),
      firstValueFrom(this.userDataService.getAll()),
    ]);
    const result = validateUser(input, { employees, users });
    const employee = employees.find(candidate => candidate.id === result.values?.employeeId);
    if (result.values === null || employee === undefined) {
      return {
        ok: false,
        reason: 'invalid',
        errors: result.errors,
        firstErrorField: result.firstErrorField,
      };
    }
    const user: AppUser = {
      id: nextRecordId(
        'usr',
        users.map(item => item.id)
      ),
      username: result.values.username,
      displayName: employee.name,
      initials: initialsFromName(employee.name),
      role: result.values.role,
      employeeId: employee.id,
      status: UserStatus.ACTIVE,
      lastSignIn: '',
    };
    const linked = { ...employee, userId: user.id };
    const saved = await firstValueFrom(this.userDataService.save(user));
    await firstValueFrom(this.employeeDataService.save(linked));
    this.sessionCredentialStore.register(saved.username, {
      userId: saved.id,
      password: result.values.password,
      pin: result.values.pin,
      mustChangePassword: result.values.mustChangePassword,
    });
    return { ok: true, user: saved };
  }

  async changeRole(userId: string, role: string): Promise<UpdateUserResult> {
    if (!this.canAdminister()) return { ok: false, reason: 'denied' };
    if (userId === this.authService.currentUser()?.id) {
      return { ok: false, reason: 'own-account' };
    }
    if (!isUserRole(role)) return { ok: false, reason: 'invalid' };
    if (role === UserRole.ADMIN && !this.actingAsAdmin()) return { ok: false, reason: 'denied' };
    const user = await firstValueFrom(this.userDataService.getById(userId));
    if (user === null) return { ok: false, reason: 'not-found' };
    if (user.role === UserRole.ADMIN && !this.actingAsAdmin()) {
      return { ok: false, reason: 'denied' };
    }
    return { ok: true, user: await firstValueFrom(this.userDataService.save({ ...user, role })) };
  }

  async setDisabled(userId: string, disabled: boolean): Promise<UpdateUserResult> {
    if (!this.canAdminister()) return { ok: false, reason: 'denied' };
    if (userId === this.authService.currentUser()?.id) {
      return { ok: false, reason: 'own-account' };
    }
    const user = await firstValueFrom(this.userDataService.getById(userId));
    if (user === null) return { ok: false, reason: 'not-found' };
    if (user.role === UserRole.ADMIN && !this.actingAsAdmin()) {
      return { ok: false, reason: 'denied' };
    }
    const status = disabled ? UserStatus.DISABLED : UserStatus.ACTIVE;
    return {
      ok: true,
      user: await firstValueFrom(this.userDataService.save({ ...user, status })),
    };
  }

  private actingAsAdmin(): boolean {
    return this.authService.currentUser()?.role === UserRole.ADMIN;
  }

  private canAdminister(): boolean {
    return (
      this.authService.currentUser() !== null && this.permissionService.canWrite(ModuleKey.USERS)
    );
  }
}
