import { Component, inject, signal } from '@angular/core';
import { ClockService } from '../../../../../core/services/clock.service';
import { PayrollAdminService } from '../../../../../core/services/payroll-admin.service';
import { PAYROLL_REASON_MAX } from '../../../../../core/utils/payroll-validation.util';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FIELD_IMPORTS } from '../../../../../shared/components/field/field.imports';
import { createUniqueId } from '../../../../../shared/utils/unique-id.util';
import { PayrollDialogBase } from '../payroll-dialog.base';

@Component({
  selector: 'app-nopay-dialog',
  imports: [...FIELD_IMPORTS, ConfirmDialogComponent],
  templateUrl: './nopay-dialog.component.html',
  styleUrl: '../payroll-dialog.scss',
})
export class NopayDialogComponent extends PayrollDialogBase {
  private readonly adminService = inject(PayrollAdminService);

  protected readonly reasonMax = PAYROLL_REASON_MAX;
  protected readonly fieldIds = {
    date: createUniqueId('payroll-nopay-date'),
    amount: createUniqueId('payroll-nopay-amount'),
    reason: createUniqueId('payroll-nopay-reason'),
  };
  protected readonly date = signal(inject(ClockService).today());
  protected readonly amount = signal('');
  protected readonly reason = signal('');

  protected onDate(event: Event): void {
    this.date.set((event.target as HTMLInputElement).value);
  }

  protected onAmount(event: Event): void {
    this.amount.set((event.target as HTMLInputElement).value);
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value.slice(0, PAYROLL_REASON_MAX));
  }

  protected save(): Promise<void> {
    const employee = this.row().employee;
    return this.submit(
      () =>
        this.adminService.addNopay({
          employeeId: employee.id,
          date: this.date(),
          amount: this.amount(),
          reason: this.reason(),
        }),
      this.confirmation(`Nopay amount added for ${employee.name}.`, this.date())
    );
  }
}
