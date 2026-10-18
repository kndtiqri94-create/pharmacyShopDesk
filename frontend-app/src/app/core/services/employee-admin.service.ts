import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { createUniqueId } from '../../shared/utils/unique-id.util';
import { Employee } from '../models/domain/employee.model';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { ModuleKey } from '../models/enums/module-key.enum';
import { fromDraft } from '../utils/employee-diff.util';
import { hasHistory, hasLinkedUser } from '../utils/employee-history.util';
import {
  EmployeeFieldErrors,
  EmployeeFormInput,
  validateEmployee,
} from '../utils/employee-validation.util';
import { AuthService } from './auth/auth.service';
import { ClockService } from './clock.service';
import { EmployeeDataService } from './data/employee-data.service';
import { UserDataService } from './data/user-data.service';
import { PermissionService } from './permission.service';

export type EmployeeAdminFailure = 'denied' | 'busy' | 'not-found' | 'invalid';

export type EmployeeSaveResult =
  | { ok: true; employee: Employee }
  | {
      ok: false;
      reason: EmployeeAdminFailure;
      errors: EmployeeFieldErrors;
      firstErrorField: string | null;
    };

export const EmployeeRemoval = {
  REMOVED: 'REMOVED',
  DEACTIVATED: 'DEACTIVATED',
} as const;
export type EmployeeRemoval = (typeof EmployeeRemoval)[keyof typeof EmployeeRemoval];

export type EmployeeRemoveResult =
  | { ok: true; outcome: EmployeeRemoval; employee: Employee }
  | { ok: false; reason: EmployeeAdminFailure };

const NO_ERRORS: EmployeeFieldErrors = {};
const DEFAULT_JOB_TITLE = 'Staff';
const DEFAULT_SHIFT = 'Morning';
const DEFAULT_EMPLOYMENT_TYPE = 'Full-time';

@Injectable({ providedIn: 'root' })
export class EmployeeAdminService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly employeeDataService = inject(EmployeeDataService);
  private readonly userDataService = inject(UserDataService);
  private readonly clockService = inject(ClockService);

  private busy = false;

  create(input: EmployeeFormInput): Promise<EmployeeSaveResult> {
    return this.guarded(() => this.save(input, null));
  }

  update(id: string, input: EmployeeFormInput): Promise<EmployeeSaveResult> {
    return this.guarded(() => this.save(input, id));
  }

  async remove(id: string): Promise<EmployeeRemoveResult> {
    if (!this.canWrite()) return { ok: false, reason: 'denied' };
    if (this.busy) return { ok: false, reason: 'busy' };
    this.busy = true;
    try {
      const [employees, users] = await this.readFresh();
      const employee = employees.find(candidate => candidate.id === id);
      if (employee === undefined) return { ok: false, reason: 'not-found' };
      if (hasHistory(employee, users)) {
        const deactivated: Employee = { ...employee, status: EmployeeStatus.INACTIVE };
        const saved = await firstValueFrom(this.employeeDataService.save(deactivated));
        return { ok: true, outcome: EmployeeRemoval.DEACTIVATED, employee: saved };
      }
      await firstValueFrom(this.employeeDataService.delete(id));
      return { ok: true, outcome: EmployeeRemoval.REMOVED, employee };
    } finally {
      this.busy = false;
    }
  }

  private async guarded(run: () => Promise<EmployeeSaveResult>): Promise<EmployeeSaveResult> {
    if (!this.canWrite()) return this.failure('denied');
    if (this.busy) return this.failure('busy');
    this.busy = true;
    try {
      return await run();
    } finally {
      this.busy = false;
    }
  }

  private async save(input: EmployeeFormInput, id: string | null): Promise<EmployeeSaveResult> {
    const [employees, users] = await this.readFresh();
    const existing = id === null ? null : (employees.find(item => item.id === id) ?? null);
    if (id !== null && existing === null) return this.failure('not-found');

    const result = validateEmployee(input, {
      employees,
      editingId: id,
      today: this.clockService.today(),
    });
    if (result.values === null) {
      return {
        ok: false,
        reason: 'invalid',
        errors: result.errors,
        firstErrorField: result.firstErrorField,
      };
    }

    const base = existing ?? this.newBase();
    const linked = existing !== null && hasLinkedUser(existing, users);
    const linkedUserId = linked
      ? (existing.userId ?? users.find(user => user.employeeId === base.id)?.id ?? null)
      : null;
    const next: Employee = {
      ...fromDraft(result.values, base),
      id: base.id,
      createdAt: base.createdAt,
      userId: linkedUserId,
      createUserAccount: linked ? true : result.values.createUserAccount,
    };

    const saved = await firstValueFrom(this.employeeDataService.save(next));
    return { ok: true, employee: saved };
  }

  private newBase(): Employee {
    return {
      id: createUniqueId('emp'),
      createdAt: this.clockService.now(),
      userId: null,
      jobTitle: DEFAULT_JOB_TITLE,
      shift: DEFAULT_SHIFT,
      employmentType: DEFAULT_EMPLOYMENT_TYPE,
    } as Employee;
  }

  private readFresh() {
    return Promise.all([
      firstValueFrom(this.employeeDataService.getAll()),
      firstValueFrom(this.userDataService.getAll()),
    ]);
  }

  private failure(reason: EmployeeAdminFailure): EmployeeSaveResult {
    return { ok: false, reason, errors: NO_ERRORS, firstErrorField: null };
  }

  private canWrite(): boolean {
    return (
      this.authService.currentUser() !== null &&
      this.permissionService.canWrite(ModuleKey.EMPLOYEES)
    );
  }
}
