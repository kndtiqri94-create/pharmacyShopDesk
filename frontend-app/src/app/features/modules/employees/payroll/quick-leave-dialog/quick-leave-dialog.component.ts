import { Component, inject, signal } from '@angular/core';
import { ClockService } from '../../../../../core/services/clock.service';
import { PayrollAdminService } from '../../../../../core/services/payroll-admin.service';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FIELD_IMPORTS } from '../../../../../shared/components/field/field.imports';
import { createUniqueId } from '../../../../../shared/utils/unique-id.util';
import { PayrollDialogBase } from '../payroll-dialog.base';

@Component({
  selector: 'app-quick-leave-dialog',
  imports: [...FIELD_IMPORTS, ConfirmDialogComponent],
  templateUrl: './quick-leave-dialog.component.html',
  styleUrl: '../payroll-dialog.scss',
})
export class QuickLeaveDialogComponent extends PayrollDialogBase {
  private readonly adminService = inject(PayrollAdminService);

  protected readonly fieldIds = { date: createUniqueId('payroll-leave-date') };
  protected readonly date = signal(inject(ClockService).today());

  protected onDate(event: Event): void {
    this.date.set((event.target as HTMLInputElement).value);
  }

  protected save(): Promise<void> {
    const employee = this.row().employee;
    return this.submit(
      () => this.adminService.addQuickLeave({ employeeId: employee.id, date: this.date() }),
      this.confirmation(`Leave added for ${employee.name}.`, this.date())
    );
  }
}
