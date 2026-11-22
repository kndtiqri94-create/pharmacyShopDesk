import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { Employee } from '../models/domain/employee.model';
import { PayrollPaymentStatus } from '../models/enums/payroll-payment-status.enum';
import {
  PayrollCalculation,
  approvedLeaveDaysInMonth,
  calculatePayroll,
} from '../utils/payroll-calculation.util';
import {
  PayrollFilters,
  PayrollTab,
  payrollMonthKey,
  selectPayrollEmployees,
} from '../utils/payroll-list.util';
import { PayrollRecords, selectPayrollRecords } from '../utils/payroll-records.util';
import { listLocations } from '../utils/employee-list.util';
import { EmployeeDataService } from './data/employee-data.service';
import { LeaveDataService } from './data/leave-data.service';
import { PayrollDataService } from './data/payroll-data.service';

export interface PayrollRow {
  employee: Employee;
  pay: PayrollCalculation;
}

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private readonly employeeDataService = inject(EmployeeDataService);
  private readonly leaveDataService = inject(LeaveDataService);
  private readonly payrollDataService = inject(PayrollDataService);

  getPayrollRows(tab: PayrollTab, filters: PayrollFilters): Observable<PayrollRow[]> {
    const month = payrollMonthKey(filters);
    return forkJoin({
      employees: this.employeeDataService.getAll(),
      leaves: this.leaveDataService.getRequests(),
      settings: this.payrollDataService.getSettings(),
      inputs: this.payrollDataService.getInputs(),
      advances: this.payrollDataService.getAdvances(),
      nopay: this.payrollDataService.getNopayEntries(),
      payments: this.payrollDataService.getPayments(),
    }).pipe(
      map(payrollSources =>
        selectPayrollEmployees(payrollSources.employees, tab, filters).map(employee => ({
          employee,
          pay: calculatePayroll(
            employee,
            month,
            payrollSources.inputs.find(
              input => input.employeeId === employee.id && input.month === month
            ) ?? null,
            payrollSources.advances,
            payrollSources.nopay,
            payrollSources.settings,
            approvedLeaveDaysInMonth(payrollSources.leaves, employee.id, month),
            payrollSources.payments.find(
              payment => payment.employeeId === employee.id && payment.month === month
            )?.status ?? PayrollPaymentStatus.UNPAID
          ),
        }))
      )
    );
  }

  getRecords(employeeId: string, month: string): Observable<PayrollRecords> {
    return forkJoin({
      advances: this.payrollDataService.getAdvances(),
      leaves: this.leaveDataService.getRequests(),
      types: this.leaveDataService.getTypes(),
    }).pipe(
      map(recordSources =>
        selectPayrollRecords(
          employeeId,
          month,
          recordSources.advances,
          recordSources.leaves,
          recordSources.types
        )
      )
    );
  }

  getLocations(): Observable<string[]> {
    return this.employeeDataService.getAll().pipe(map(employees => listLocations(employees)));
  }
}
