import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { createUniqueId } from '../../shared/utils/unique-id.util';
import { Employee } from '../models/domain/employee.model';
import { LeaveRequest } from '../models/domain/leave-request.model';
import { NopayEntry } from '../models/domain/nopay-entry.model';
import { SalaryAdvance } from '../models/domain/salary-advance.model';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { ModuleKey } from '../models/enums/module-key.enum';
import { calculatePayroll, approvedLeaveDaysInMonth } from '../utils/payroll-calculation.util';
import {
  NopayFormInput,
  PayrollFieldErrors,
  PayrollValidationContext,
  QuickLeaveFormInput,
  SalaryAdvanceFormInput,
  validateNopay,
  validateQuickLeaveDate,
  validateSalaryAdvance,
} from '../utils/payroll-validation.util';
import { AuthService } from './auth/auth.service';
import { ClockService } from './clock.service';
import { EmployeeDataService } from './data/employee-data.service';
import { LeaveDataService } from './data/leave-data.service';
import { PayrollDataService } from './data/payroll-data.service';
import { LeaveAdminService } from './leave-admin.service';
import { PermissionService } from './permission.service';

export type PayrollAdminFailure = 'denied' | 'busy' | 'not-found' | 'invalid' | 'not-allowed';

export interface PayrollAdminFailureResult {
  ok: false;
  reason: PayrollAdminFailure;
  errors: PayrollFieldErrors;
  firstErrorField: string | null;
  message?: string;
}

export type SalaryAdvanceInput = SalaryAdvanceFormInput & { employeeId: string };
export type NopayInput = NopayFormInput & { employeeId: string };
export type QuickLeaveInput = QuickLeaveFormInput & { employeeId: string };

export type SalaryAdvanceResult = { ok: true; advance: SalaryAdvance } | PayrollAdminFailureResult;
export type NopayResult = { ok: true; entry: NopayEntry } | PayrollAdminFailureResult;
export type QuickLeaveResult = { ok: true; request: LeaveRequest } | PayrollAdminFailureResult;

const NO_ERRORS: PayrollFieldErrors = {};
const INACTIVE_MESSAGE = 'Inactive employees cannot be changed here';

@Injectable({ providedIn: 'root' })
export class PayrollAdminService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly employeeDataService = inject(EmployeeDataService);
  private readonly leaveDataService = inject(LeaveDataService);
  private readonly payrollDataService = inject(PayrollDataService);
  private readonly leaveAdminService = inject(LeaveAdminService);
  private readonly clockService = inject(ClockService);

  private busy = false;

  addSalaryAdvance(input: SalaryAdvanceInput): Promise<SalaryAdvanceResult> {
    return this.guarded(input.employeeId, async (employee, context) => {
      const result = validateSalaryAdvance(input, context);
      if (result.values === null) return this.invalid(result.errors, result.firstErrorField);
      const next: SalaryAdvance = {
        id: createUniqueId('adv'),
        employeeId: employee.id,
        counter: result.values.counter,
        date: result.values.date,
        amountCents: result.values.amountCents,
        createdAt: this.clockService.now(),
      };
      const advance = await firstValueFrom(this.payrollDataService.saveAdvance(next));
      return { ok: true as const, advance };
    });
  }

  addNopay(input: NopayInput): Promise<NopayResult> {
    return this.guarded(input.employeeId, async (employee, context) => {
      const result = validateNopay(input, context);
      if (result.values === null) return this.invalid(result.errors, result.firstErrorField);
      const next: NopayEntry = {
        id: createUniqueId('nop'),
        employeeId: employee.id,
        date: result.values.date,
        amountCents: result.values.amountCents,
        reason: result.values.reason,
        createdAt: this.clockService.now(),
      };
      const entry = await firstValueFrom(this.payrollDataService.saveNopay(next));
      return { ok: true as const, entry };
    });
  }

  addQuickLeave(input: QuickLeaveInput): Promise<QuickLeaveResult> {
    return this.guarded(input.employeeId, async employee => {
      const result = validateQuickLeaveDate(input);
      if (result.values === null) return this.invalid(result.errors, result.firstErrorField);
      const leave = await this.leaveAdminService.applyApprovedDay({
        employeeId: employee.id,
        date: result.values.date,
      });
      if (leave.ok) return { ok: true as const, request: leave.request };
      const message = leave.message;
      const onDate = leave.reason === 'invalid' && message !== undefined;
      return {
        ok: false as const,
        reason: leave.reason,
        errors: onDate ? { date: message } : NO_ERRORS,
        firstErrorField: onDate ? 'date' : null,
        message,
      };
    });
  }

  private async guarded<T>(
    employeeId: string,
    run: (employee: Employee, context: PayrollValidationContext) => Promise<T>
  ): Promise<T | PayrollAdminFailureResult> {
    if (!this.canWrite()) return this.failure('denied');
    if (this.busy) return this.failure('busy');
    this.busy = true;
    try {
      const fresh = await this.readFresh();
      const employee = fresh.employees.find(item => item.id === employeeId);
      if (employee === undefined) return this.failure('not-found');
      if (employee.status === EmployeeStatus.INACTIVE) {
        return this.failure('not-allowed', INACTIVE_MESSAGE);
      }
      const context: PayrollValidationContext = {
        counters: fresh.settings.counters,
        grossCentsForMonth: month =>
          calculatePayroll(
            employee,
            month,
            fresh.inputs.find(item => item.employeeId === employee.id && item.month === month) ??
              null,
            fresh.advances,
            fresh.nopay,
            fresh.settings,
            approvedLeaveDaysInMonth(fresh.leaves, employee.id, month)
          ).grossCents,
      };
      return await run(employee, context);
    } finally {
      this.busy = false;
    }
  }

  private async readFresh() {
    const [employees, leaves, settings, inputs, advances, nopay] = await Promise.all([
      firstValueFrom(this.employeeDataService.getAll()),
      firstValueFrom(this.leaveDataService.getRequests()),
      firstValueFrom(this.payrollDataService.getSettings()),
      firstValueFrom(this.payrollDataService.getInputs()),
      firstValueFrom(this.payrollDataService.getAdvances()),
      firstValueFrom(this.payrollDataService.getNopayEntries()),
    ]);
    return { employees, leaves, settings, inputs, advances, nopay };
  }

  private invalid(
    errors: PayrollFieldErrors,
    firstErrorField: string | null
  ): PayrollAdminFailureResult {
    return { ok: false, reason: 'invalid', errors, firstErrorField };
  }

  private failure(reason: PayrollAdminFailure, message?: string): PayrollAdminFailureResult {
    return { ok: false, reason, errors: NO_ERRORS, firstErrorField: null, message };
  }

  private canWrite(): boolean {
    return (
      this.authService.currentUser() !== null && this.permissionService.canWrite(ModuleKey.PAYROLL)
    );
  }
}
