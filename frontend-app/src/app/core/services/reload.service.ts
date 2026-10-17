import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ReloadFloat } from '../models/domain/reload-float.model';
import { ReloadTransaction } from '../models/domain/reload-transaction.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { ReloadStatus } from '../models/enums/reload-status.enum';
import { ReloadTransactionType } from '../models/enums/reload-transaction-type.enum';
import { nextRecordId } from '../utils/document-number.util';
import { billTotalCents, commissionCents } from '../utils/reload-commission.util';
import { currentFloat, nextOccurredAt } from '../utils/reload-summary.util';
import {
  BillFieldErrors,
  BillFieldKey,
  BillFormInput,
  ReloadFieldErrors,
  ReloadFieldKey,
  ReloadFormInput,
  isValidTopUpCents,
  validateBill,
  validateReload,
} from '../utils/reload-validation.util';
import { AuthService } from './auth/auth.service';
import { ClockService } from './clock.service';
import { ReloadDataService } from './data/reload-data.service';
import { PermissionService } from './permission.service';

export type ReloadFailure = 'denied' | 'busy' | 'invalid' | 'no-float';

export type SendReloadResult =
  | { ok: true; transaction: ReloadTransaction; float: ReloadFloat }
  | {
      ok: false;
      reason: ReloadFailure;
      errors: ReloadFieldErrors;
      firstErrorField: ReloadFieldKey | null;
    };

export type PayBillResult =
  | { ok: true; transaction: ReloadTransaction; float: ReloadFloat; totalCents: number }
  | {
      ok: false;
      reason: ReloadFailure;
      errors: BillFieldErrors;
      firstErrorField: BillFieldKey | null;
    };

export type TopUpFloatResult =
  { ok: true; float: ReloadFloat } | { ok: false; reason: ReloadFailure };

@Injectable({ providedIn: 'root' })
export class ReloadService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly clockService = inject(ClockService);
  private readonly reloadDataService = inject(ReloadDataService);
  private busy = false;

  async sendReload(input: ReloadFormInput): Promise<SendReloadResult> {
    const blocked = this.blockedReason();
    if (blocked !== null) return { ok: false, reason: blocked, errors: {}, firstErrorField: null };
    this.busy = true;
    try {
      return await this.applyReload(input);
    } finally {
      this.busy = false;
    }
  }

  async payBill(input: BillFormInput): Promise<PayBillResult> {
    const blocked = this.blockedReason();
    if (blocked !== null) return { ok: false, reason: blocked, errors: {}, firstErrorField: null };
    this.busy = true;
    try {
      return await this.applyBill(input);
    } finally {
      this.busy = false;
    }
  }

  async topUpFloat(amountCents: number): Promise<TopUpFloatResult> {
    const blocked = this.blockedReason();
    if (blocked !== null) return { ok: false, reason: blocked };
    this.busy = true;
    try {
      return await this.applyTopUp(amountCents);
    } finally {
      this.busy = false;
    }
  }

  private blockedReason(): ReloadFailure | null {
    if (
      this.authService.currentUser() === null ||
      !this.permissionService.canWrite(ModuleKey.RELOAD_UTILITY)
    ) {
      return 'denied';
    }
    return this.busy ? 'busy' : null;
  }

  private async readState() {
    const [history, transactions] = await Promise.all([
      firstValueFrom(this.reloadDataService.getFloatHistory()),
      firstValueFrom(this.reloadDataService.getTransactions()),
    ]);
    return { float: currentFloat(history), transactions };
  }

  private async applyReload(input: ReloadFormInput): Promise<SendReloadResult> {
    const { float, transactions } = await this.readState();
    if (float === null) return { ok: false, reason: 'no-float', errors: {}, firstErrorField: null };
    const result = validateReload(input, float.availableCents);
    if (result.values === null) {
      return {
        ok: false,
        reason: 'invalid',
        errors: result.errors,
        firstErrorField: result.firstErrorField,
      };
    }
    const { operator, reference, amountCents } = result.values;
    const commission = commissionCents(amountCents);
    const nextFloat: ReloadFloat = {
      ...float,
      availableCents: float.availableCents - amountCents,
      reloadsCount: float.reloadsCount + 1,
      commissionCents: float.commissionCents + commission,
    };
    const transaction = this.buildTransaction(transactions, {
      provider: operator,
      type: ReloadTransactionType.RELOAD,
      reference,
      amountCents,
      commissionCents: commission,
    });
    const savedFloat = await firstValueFrom(this.reloadDataService.saveFloat(nextFloat));
    const saved = await firstValueFrom(this.reloadDataService.addTransaction(transaction));
    return { ok: true, transaction: saved, float: savedFloat };
  }

  private async applyBill(input: BillFormInput): Promise<PayBillResult> {
    const { float, transactions } = await this.readState();
    if (float === null) return { ok: false, reason: 'no-float', errors: {}, firstErrorField: null };
    const result = validateBill(input);
    if (result.values === null) {
      return {
        ok: false,
        reason: 'invalid',
        errors: result.errors,
        firstErrorField: result.firstErrorField,
      };
    }
    const { provider, account, amountCents } = result.values;
    const nextFloat: ReloadFloat = { ...float, billsCount: float.billsCount + 1 };
    const transaction = this.buildTransaction(transactions, {
      provider,
      type: ReloadTransactionType.BILL_PAYMENT,
      reference: `Account ${account}`,
      amountCents,
      commissionCents: 0,
    });
    const savedFloat = await firstValueFrom(this.reloadDataService.saveFloat(nextFloat));
    const saved = await firstValueFrom(this.reloadDataService.addTransaction(transaction));
    return {
      ok: true,
      transaction: saved,
      float: savedFloat,
      totalCents: billTotalCents(amountCents),
    };
  }

  private async applyTopUp(amountCents: number): Promise<TopUpFloatResult> {
    if (!isValidTopUpCents(amountCents)) return { ok: false, reason: 'invalid' };
    const { float } = await this.readState();
    if (float === null) return { ok: false, reason: 'no-float' };
    const saved = await firstValueFrom(
      this.reloadDataService.saveFloat({
        ...float,
        availableCents: float.availableCents + amountCents,
      })
    );
    return { ok: true, float: saved };
  }

  private buildTransaction(
    existing: readonly ReloadTransaction[],
    details: Pick<
      ReloadTransaction,
      'provider' | 'type' | 'reference' | 'amountCents' | 'commissionCents'
    >
  ): ReloadTransaction {
    return {
      ...details,
      id: nextRecordId(
        'rt',
        existing.map(transaction => transaction.id)
      ),
      occurredAt: nextOccurredAt(this.clockService.now(), existing),
      status: ReloadStatus.SUCCESS,
    };
  }
}
