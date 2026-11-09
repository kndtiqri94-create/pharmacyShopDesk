import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModuleKey } from '../models/enums/module-key.enum';
import { CashLedgerSources } from '../utils/pos-cash-ledger.util';
import { DueSources } from '../utils/pos-due.util';
import { SalesDataService } from './data/sales-data.service';
import { PermissionService } from './permission.service';

export type PosRecords = CashLedgerSources & DueSources;

@Injectable({ providedIn: 'root' })
export class PosRecordsService {
  private readonly salesDataService = inject(SalesDataService);
  private readonly permissionService = inject(PermissionService);

  async load(): Promise<PosRecords> {
    if (!this.permissionService.canView(ModuleKey.POS)) {
      return { sales: [], returns: [], duePayments: [], openingDues: [] };
    }
    const [sales, returns, duePayments, openingDues] = await Promise.all([
      firstValueFrom(this.salesDataService.getSales()),
      firstValueFrom(this.salesDataService.getReturns()),
      firstValueFrom(this.salesDataService.getDuePayments()),
      firstValueFrom(this.salesDataService.getOpeningDues()),
    ]);
    return { sales, returns, duePayments, openingDues };
  }
}
