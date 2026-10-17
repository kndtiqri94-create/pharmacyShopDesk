import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SupplierPayment } from '../models/domain/supplier-payment.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { nextRecordId } from '../utils/document-number.util';
import { amountOwedToSupplier } from '../utils/supplier-owed.util';
import { allocatePayment } from '../utils/supplier-payment.util';
import { AuthService } from './auth/auth.service';
import { ClockService } from './clock.service';
import { GrnDataService } from './data/grn-data.service';
import { SupplierDataService } from './data/supplier-data.service';
import { SupplierPaymentDataService } from './data/supplier-payment-data.service';
import { PermissionService } from './permission.service';

export type SupplierPaymentFailure =
  'denied' | 'busy' | 'not-found' | 'nothing-owed' | 'invalid-amount' | 'too-much';

export type SupplierPaymentResult =
  | { ok: true; payment: SupplierPayment; owedCents: number }
  | { ok: false; reason: SupplierPaymentFailure };

@Injectable({ providedIn: 'root' })
export class SupplierPaymentService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly clockService = inject(ClockService);
  private readonly grnDataService = inject(GrnDataService);
  private readonly supplierDataService = inject(SupplierDataService);
  private readonly supplierPaymentDataService = inject(SupplierPaymentDataService);
  private busy = false;

  async recordPayment(supplierId: string, amountCents: number): Promise<SupplierPaymentResult> {
    const user = this.authService.currentUser();
    if (user === null || !this.permissionService.canWrite(ModuleKey.SUPPLIERS)) {
      return { ok: false, reason: 'denied' };
    }
    if (this.busy) return { ok: false, reason: 'busy' };
    this.busy = true;
    try {
      return await this.apply(supplierId, amountCents, user.displayName);
    } finally {
      this.busy = false;
    }
  }

  private async apply(
    supplierId: string,
    amountCents: number,
    recordedBy: string
  ): Promise<SupplierPaymentResult> {
    const [supplier, grns, payments] = await Promise.all([
      firstValueFrom(this.supplierDataService.getById(supplierId)),
      firstValueFrom(this.grnDataService.getAll()),
      firstValueFrom(this.supplierPaymentDataService.getAll()),
    ]);
    if (supplier === null) return { ok: false, reason: 'not-found' };
    const owedCents = amountOwedToSupplier(grns, supplierId);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return { ok: false, reason: 'invalid-amount' };
    }
    if (owedCents === 0) return { ok: false, reason: 'nothing-owed' };
    if (amountCents > owedCents) return { ok: false, reason: 'too-much' };
    const allocation = allocatePayment(grns, supplierId, amountCents);
    const payment: SupplierPayment = {
      id: nextRecordId(
        'pay',
        payments.map(item => item.id)
      ),
      supplierId,
      paidDate: this.clockService.today(),
      amountCents,
      allocations: allocation.allocations,
      recordedBy,
    };
    for (const grn of allocation.grns) await firstValueFrom(this.grnDataService.save(grn));
    const saved = await firstValueFrom(this.supplierPaymentDataService.save(payment));
    return { ok: true, payment: saved, owedCents: owedCents - amountCents };
  }
}
