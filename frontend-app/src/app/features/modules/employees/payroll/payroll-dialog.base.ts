import { Directive, ElementRef, inject, input, output, signal } from '@angular/core';
import { PayrollAdminFailureResult } from '../../../../core/services/payroll-admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PayrollRow } from '../../../../core/services/payroll.service';
import { isIsoDate } from '../../../../core/utils/date.util';
import { monthOfDate } from '../../../../core/utils/payroll-calculation.util';
import { payrollMonthLabel } from '../../../../core/utils/payroll-list.util';
import { describePayrollFailure } from '../../../../core/utils/payroll-failure.util';
import { PayrollFieldErrors } from '../../../../core/utils/payroll-validation.util';

@Directive()
export abstract class PayrollDialogBase {
  readonly row = input.required<PayrollRow>();
  readonly month = input<string>('');
  readonly finished = output<void>();
  readonly cancelled = output<void>();

  protected readonly working = signal(false);
  protected readonly errors = signal<PayrollFieldErrors>({});
  protected readonly formError = signal<string | null>(null);
  protected abstract readonly fieldIds: Readonly<Record<string, string>>;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notificationService = inject(NotificationService);

  protected error(key: string): string | null {
    return this.errors()[key] ?? null;
  }

  protected confirmation(message: string, date: string): string {
    const shown = this.month();
    if (shown === '' || !isIsoDate(date) || monthOfDate(date) === shown) return message;
    const label = payrollMonthLabel(Number(date.slice(5, 7)));
    return `${message} It applies to ${label} ${date.slice(0, 4)}.`;
  }

  protected cancel(): void {
    if (!this.working()) this.cancelled.emit();
  }

  protected async submit(
    action: () => Promise<{ ok: true } | PayrollAdminFailureResult>,
    success: string
  ): Promise<void> {
    if (this.working()) return;
    this.working.set(true);
    this.errors.set({});
    this.formError.set(null);
    try {
      const result = await action();
      if (result.ok) {
        this.notificationService.show('success', success);
        this.finished.emit();
        return;
      }
      this.fail(result);
    } finally {
      this.working.set(false);
    }
  }

  private fail(result: PayrollAdminFailureResult): void {
    const view = describePayrollFailure(result, this.row().employee.name);
    if (view.closes) {
      this.notificationService.show('warning', view.message);
      this.finished.emit();
      return;
    }
    this.errors.set(view.errors);
    this.formError.set(view.message);
    const target = result.firstErrorField === null ? null : this.fieldIds[result.firstErrorField];
    if (target !== undefined) {
      this.host.nativeElement.querySelector<HTMLElement>(`#${target}`)?.focus();
    }
  }
}
