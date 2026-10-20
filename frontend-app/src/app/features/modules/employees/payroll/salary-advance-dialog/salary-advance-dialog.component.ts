import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ClockService } from '../../../../../core/services/clock.service';
import { PayrollDataService } from '../../../../../core/services/data/payroll-data.service';
import { PayrollAdminService } from '../../../../../core/services/payroll-admin.service';
import { isIsoDate } from '../../../../../core/utils/date.util';
import { formatRupeesExact } from '../../../../../core/utils/money.util';
import { monthOfDate } from '../../../../../core/utils/payroll-calculation.util';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FIELD_IMPORTS } from '../../../../../shared/components/field/field.imports';
import { createUniqueId } from '../../../../../shared/utils/unique-id.util';
import { PayrollDialogBase } from '../payroll-dialog.base';

@Component({
  selector: 'app-salary-advance-dialog',
  imports: [...FIELD_IMPORTS, ConfirmDialogComponent],
  templateUrl: './salary-advance-dialog.component.html',
  styleUrl: '../payroll-dialog.scss',
})
export class SalaryAdvanceDialogComponent extends PayrollDialogBase {
  private readonly adminService = inject(PayrollAdminService);

  protected readonly fieldIds = {
    counter: createUniqueId('payroll-advance-counter'),
    date: createUniqueId('payroll-advance-date'),
    amount: createUniqueId('payroll-advance-amount'),
  };
  protected readonly counters = toSignal(
    inject(PayrollDataService)
      .getSettings()
      .pipe(map(settings => settings.counters)),
    { initialValue: [] }
  );
  protected readonly counter = signal('');
  protected readonly date = signal(inject(ClockService).today());
  protected readonly amount = signal('');
  protected readonly limitHint = computed(() => {
    const date = this.date();
    const inMonth = isIsoDate(date) && monthOfDate(date) === this.month();
    return inMonth
      ? `Cannot be more than this month's gross salary of ${formatRupeesExact(this.row().pay.grossCents)}.`
      : 'Cannot be more than the gross salary of the month of the date.';
  });

  protected onCounter(event: Event): void {
    this.counter.set((event.target as HTMLSelectElement).value);
  }

  protected onDate(event: Event): void {
    this.date.set((event.target as HTMLInputElement).value);
  }

  protected onAmount(event: Event): void {
    this.amount.set((event.target as HTMLInputElement).value);
  }

  protected save(): Promise<void> {
    const employee = this.row().employee;
    return this.submit(
      () =>
        this.adminService.addSalaryAdvance({
          employeeId: employee.id,
          counter: this.counter(),
          date: this.date(),
          amount: this.amount(),
        }),
      this.confirmation(`Salary advance added for ${employee.name}.`, this.date())
    );
  }
}
