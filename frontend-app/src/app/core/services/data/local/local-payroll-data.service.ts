import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { NopayEntry } from '../../../models/domain/nopay-entry.model';
import { PayrollInput } from '../../../models/domain/payroll-input.model';
import { PayrollPayment } from '../../../models/domain/payroll-payment.model';
import { PayrollSettings } from '../../../models/domain/payroll-settings.model';
import { SalaryAdvance } from '../../../models/domain/salary-advance.model';
import { cloneValue } from '../../../utils/clone.util';
import { PAYROLL_SETTINGS_SEED } from '../in-memory/seed/payroll.seed';
import { PayrollDataService } from '../payroll-data.service';
import { LocalCollection } from './local-collection';
import { LocalDatabaseProvider } from './local-database.provider';
import { DOCUMENT_IDS, readDocument } from './local-meta';

@Injectable()
export class LocalPayrollDataService extends PayrollDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  getSettings(): Observable<PayrollSettings> {
    return this.databaseProvider.observe(async db => {
      const stored = await readDocument<PayrollSettings>(db, DOCUMENT_IDS.payrollSettings);
      return cloneValue(stored ?? PAYROLL_SETTINGS_SEED);
    });
  }

  getInputs(): Observable<readonly PayrollInput[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<PayrollInput>(db.payrollInputs).all()
    );
  }

  getAdvances(): Observable<readonly SalaryAdvance[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<SalaryAdvance>(db.salaryAdvances).all()
    );
  }

  getNopayEntries(): Observable<readonly NopayEntry[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<NopayEntry>(db.nopayEntries).all()
    );
  }

  getPayments(): Observable<readonly PayrollPayment[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<PayrollPayment>(db.payrollPayments).all()
    );
  }

  saveAdvance(advance: SalaryAdvance): Observable<SalaryAdvance> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.salaryAdvances, () =>
        new LocalCollection<SalaryAdvance>(db.salaryAdvances).upsert(advance)
      )
    );
  }

  saveNopay(entry: NopayEntry): Observable<NopayEntry> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.nopayEntries, () =>
        new LocalCollection<NopayEntry>(db.nopayEntries).upsert(entry)
      )
    );
  }
}
