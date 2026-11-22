import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PayrollRow, PayrollService } from '../../../../../core/services/payroll.service';
import { formatDate } from '../../../../../core/utils/date.util';
import { formatRupeesExact } from '../../../../../core/utils/money.util';
import { PayrollRecords } from '../../../../../core/utils/payroll-records.util';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';

export type PayrollRecordsKind = 'advance' | 'leaves';

@Component({
  selector: 'app-payroll-records-dialog',
  imports: [ConfirmDialogComponent],
  templateUrl: './payroll-records-dialog.component.html',
  styleUrl: '../payroll-dialog.scss',
})
export class PayrollRecordsDialogComponent implements OnInit {
  readonly row = input.required<PayrollRow>();
  readonly kind = input.required<PayrollRecordsKind>();
  readonly monthKey = input.required<string>();
  readonly monthLabel = input.required<string>();
  readonly closed = output<void>();

  protected readonly records = signal<PayrollRecords | null>(null);
  protected readonly failed = signal(false);
  protected readonly date = formatDate;
  protected readonly money = formatRupeesExact;

  private readonly payrollService = inject(PayrollService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.payrollService
      .getRecords(this.row().employee.id, this.monthKey())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: records => this.records.set(records),
        error: () => this.failed.set(true),
      });
  }
}
