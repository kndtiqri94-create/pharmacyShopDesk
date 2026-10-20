import { Observable } from 'rxjs';
import { NopayEntry } from '../../models/domain/nopay-entry.model';
import { PayrollInput } from '../../models/domain/payroll-input.model';
import { PayrollPayment } from '../../models/domain/payroll-payment.model';
import { PayrollSettings } from '../../models/domain/payroll-settings.model';
import { SalaryAdvance } from '../../models/domain/salary-advance.model';

export abstract class PayrollDataService {
  abstract getSettings(): Observable<PayrollSettings>;
  abstract getInputs(): Observable<readonly PayrollInput[]>;
  abstract getAdvances(): Observable<readonly SalaryAdvance[]>;
  abstract getNopayEntries(): Observable<readonly NopayEntry[]>;
  abstract getPayments(): Observable<readonly PayrollPayment[]>;
  abstract saveAdvance(advance: SalaryAdvance): Observable<SalaryAdvance>;
  abstract saveNopay(entry: NopayEntry): Observable<NopayEntry>;
}
