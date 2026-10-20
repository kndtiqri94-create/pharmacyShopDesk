import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { NopayEntry } from '../../../models/domain/nopay-entry.model';
import { PayrollInput } from '../../../models/domain/payroll-input.model';
import { PayrollPayment } from '../../../models/domain/payroll-payment.model';
import { PayrollSettings } from '../../../models/domain/payroll-settings.model';
import { SalaryAdvance } from '../../../models/domain/salary-advance.model';
import { cloneValue } from '../../../utils/clone.util';
import { PayrollDataService } from '../payroll-data.service';
import { InMemoryCollection } from './in-memory-collection';
import {
  NOPAY_SEED,
  PAYROLL_INPUT_SEED,
  PAYROLL_PAYMENT_SEED,
  PAYROLL_SETTINGS_SEED,
  SALARY_ADVANCE_SEED,
} from './seed/payroll.seed';

@Injectable()
export class InMemoryPayrollDataService extends PayrollDataService {
  private readonly settings: PayrollSettings = cloneValue(PAYROLL_SETTINGS_SEED);
  private readonly inputs = new InMemoryCollection<PayrollInput>(PAYROLL_INPUT_SEED);
  private readonly advances = new InMemoryCollection<SalaryAdvance>(SALARY_ADVANCE_SEED);
  private readonly nopay = new InMemoryCollection<NopayEntry>(NOPAY_SEED);
  private readonly payments = new InMemoryCollection<PayrollPayment>(PAYROLL_PAYMENT_SEED);

  getSettings(): Observable<PayrollSettings> {
    return of(cloneValue(this.settings));
  }

  getInputs(): Observable<readonly PayrollInput[]> {
    return of(this.inputs.all());
  }

  getAdvances(): Observable<readonly SalaryAdvance[]> {
    return of(this.advances.all());
  }

  getNopayEntries(): Observable<readonly NopayEntry[]> {
    return of(this.nopay.all());
  }

  getPayments(): Observable<readonly PayrollPayment[]> {
    return of(this.payments.all());
  }

  saveAdvance(advance: SalaryAdvance): Observable<SalaryAdvance> {
    return of(this.advances.upsert(advance));
  }

  saveNopay(entry: NopayEntry): Observable<NopayEntry> {
    return of(this.nopay.upsert(entry));
  }
}
