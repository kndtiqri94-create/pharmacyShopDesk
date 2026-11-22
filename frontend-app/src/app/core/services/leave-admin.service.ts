import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { createUniqueId } from '../../shared/utils/unique-id.util';
import { AppUser } from '../models/domain/app-user.model';
import { Employee } from '../models/domain/employee.model';
import { LeaveRequest } from '../models/domain/leave-request.model';
import { LeaveReason } from '../models/enums/leave-reason.enum';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { ModuleKey } from '../models/enums/module-key.enum';
import { yearOfDate } from '../utils/leave-days.util';
import { canCancelLeave, canDecideLeave } from '../utils/leave-status.util';
import {
  LEAVE_COMMENTS_MAX,
  LeaveFieldErrors,
  LeaveFormInput,
  isEligibleApprover,
  validateLeave,
} from '../utils/leave-validation.util';
import { AuthService } from './auth/auth.service';
import { ClockService } from './clock.service';
import { EmployeeDataService } from './data/employee-data.service';
import { LeaveDataService } from './data/leave-data.service';
import { UserDataService } from './data/user-data.service';
import { PermissionService } from './permission.service';

export type LeaveAdminFailure = 'denied' | 'busy' | 'not-found' | 'invalid' | 'not-allowed';

export type LeaveDecision = 'APPROVE' | 'REJECT';

export type LeaveAdminResult =
  | { ok: true; request: LeaveRequest }
  | {
      ok: false;
      reason: LeaveAdminFailure;
      errors: LeaveFieldErrors;
      firstErrorField: string | null;
      message?: string;
    };

export const APPROVED_LEAVE_TYPE_NAME = 'Casual Leave';
export const APPROVED_LEAVE_COMMENT = 'Added from Payroll';
const NO_APPROVER_MESSAGE = 'No active Admin or Manager is available to approve this leave';
const NO_LEAVE_TYPE_MESSAGE = 'Casual Leave is not available';

export interface ApprovedLeaveInput {
  employeeId: string;
  date: string;
}

const NO_ERRORS: LeaveFieldErrors = {};

@Injectable({ providedIn: 'root' })
export class LeaveAdminService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly employeeDataService = inject(EmployeeDataService);
  private readonly userDataService = inject(UserDataService);
  private readonly leaveDataService = inject(LeaveDataService);
  private readonly clockService = inject(ClockService);

  private busy = false;

  apply(input: LeaveFormInput): Promise<LeaveAdminResult> {
    return this.guarded(
      () => this.canWrite(),
      () => this.runApply(input)
    );
  }

  applyApprovedDay(input: ApprovedLeaveInput): Promise<LeaveAdminResult> {
    return this.guarded(
      () => this.canWrite(),
      () => this.runApplyApprovedDay(input)
    );
  }

  decide(requestId: string, decision: LeaveDecision, comment: string): Promise<LeaveAdminResult> {
    return this.guarded(
      () => this.authService.currentUser() !== null,
      () => this.runDecide(requestId, decision, comment)
    );
  }

  cancel(requestId: string): Promise<LeaveAdminResult> {
    return this.guarded(
      () => this.canWrite(),
      () => this.runCancel(requestId)
    );
  }

  private async guarded(
    allowed: () => boolean,
    run: () => Promise<LeaveAdminResult>
  ): Promise<LeaveAdminResult> {
    if (!allowed()) return this.failure('denied');
    if (this.busy) return this.failure('busy');
    this.busy = true;
    try {
      return await run();
    } finally {
      this.busy = false;
    }
  }

  private async runApply(input: LeaveFormInput): Promise<LeaveAdminResult> {
    const fresh = await this.readFresh();
    const result = validateLeave(input, fresh);
    if (result.values === null) {
      return {
        ok: false,
        reason: 'invalid',
        errors: result.errors,
        firstErrorField: result.firstErrorField,
      };
    }
    const next: LeaveRequest = {
      ...result.values,
      id: createUniqueId('leave'),
      approverComment: '',
      status: LeaveStatus.PENDING,
      createdAt: this.clockService.now(),
      decidedAt: null,
    };
    return this.persist(next);
  }

  private async runApplyApprovedDay(input: ApprovedLeaveInput): Promise<LeaveAdminResult> {
    const fresh = await this.readFresh();
    const type = fresh.types.find(item => item.name === APPROVED_LEAVE_TYPE_NAME);
    if (type === undefined) return this.refusal('invalid', NO_LEAVE_TYPE_MESSAGE);
    const approverId = this.pickApprover(input.employeeId, fresh.employees, fresh.users);
    if (approverId === null) return this.refusal('not-allowed', NO_APPROVER_MESSAGE);
    const result = validateLeave(
      {
        employeeId: input.employeeId,
        year: yearOfDate(input.date),
        leaveTypeId: type.id,
        fromDate: input.date,
        toDate: input.date,
        reason: LeaveReason.OTHER,
        comments: APPROVED_LEAVE_COMMENT,
        attachment: null,
        coveringEmployeeId: '',
        approverEmployeeId: approverId,
      },
      fresh
    );
    if (result.values === null) {
      const field = result.firstErrorField;
      return {
        ok: false,
        reason: 'invalid',
        errors: result.errors,
        firstErrorField: field,
        message: field === null ? undefined : result.errors[field],
      };
    }
    const now = this.clockService.now();
    return this.persist({
      ...result.values,
      id: createUniqueId('leave'),
      approverComment: '',
      status: LeaveStatus.APPROVED,
      createdAt: now,
      decidedAt: now,
    });
  }

  private pickApprover(
    applicantId: string,
    employees: readonly Employee[],
    users: readonly AppUser[]
  ): string | null {
    const signedIn = this.authService.currentUser();
    const own = employees.find(item => signedIn !== null && item.userId === signedIn.id);
    if (own !== undefined && own.id !== applicantId && isEligibleApprover(own, users)) {
      return own.id;
    }
    const fallback = employees.find(
      item => item.id !== applicantId && isEligibleApprover(item, users)
    );
    return fallback === undefined ? null : fallback.id;
  }

  private refusal(reason: LeaveAdminFailure, message: string): LeaveAdminResult {
    return { ok: false, reason, errors: NO_ERRORS, firstErrorField: null, message };
  }

  private async runDecide(
    requestId: string,
    decision: LeaveDecision,
    comment: string
  ): Promise<LeaveAdminResult> {
    const target = decision === 'APPROVE' ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;
    if (decision !== 'APPROVE' && decision !== 'REJECT') return this.failure('invalid');
    const trimmed = typeof comment === 'string' ? comment.trim() : '';
    if (trimmed.length > LEAVE_COMMENTS_MAX) {
      return {
        ok: false,
        reason: 'invalid',
        errors: { approverComment: `Comment must be ${LEAVE_COMMENTS_MAX} characters or fewer` },
        firstErrorField: 'approverComment',
      };
    }
    const fresh = await this.readFresh();
    const request = fresh.requests.find(item => item.id === requestId);
    if (request === undefined) return this.failure('not-found');
    const actor = {
      user: this.authService.currentUser(),
      canOpenEmployees: this.permissionService.canView(ModuleKey.EMPLOYEES),
    };
    if (!canDecideLeave(request, actor, fresh.employees, fresh.users)) {
      return this.failure('not-allowed');
    }
    const next: LeaveRequest = {
      ...request,
      status: target,
      approverComment: trimmed,
      decidedAt: this.clockService.now(),
    };
    return this.persist(next);
  }

  private async runCancel(requestId: string): Promise<LeaveAdminResult> {
    const fresh = await this.readFresh();
    const request = fresh.requests.find(item => item.id === requestId);
    if (request === undefined) return this.failure('not-found');
    if (!canCancelLeave(request, this.clockService.today())) return this.failure('not-allowed');
    const next: LeaveRequest = {
      ...request,
      status: LeaveStatus.CANCELLED,
      decidedAt: this.clockService.now(),
    };
    return this.persist(next);
  }

  private async persist(next: LeaveRequest): Promise<LeaveAdminResult> {
    const saved = await firstValueFrom(this.leaveDataService.saveRequest(next));
    return { ok: true, request: saved };
  }

  private async readFresh() {
    const [employees, users, requests, entitlements, types] = await Promise.all([
      firstValueFrom(this.employeeDataService.getAll()),
      firstValueFrom(this.userDataService.getAll()),
      firstValueFrom(this.leaveDataService.getRequests()),
      firstValueFrom(this.leaveDataService.getEntitlements()),
      firstValueFrom(this.leaveDataService.getTypes()),
    ]);
    return { employees, users, requests, entitlements, types };
  }

  private failure(reason: LeaveAdminFailure): LeaveAdminResult {
    return { ok: false, reason, errors: NO_ERRORS, firstErrorField: null };
  }

  private canWrite(): boolean {
    return (
      this.authService.currentUser() !== null &&
      this.permissionService.canWrite(ModuleKey.EMPLOYEES)
    );
  }
}
