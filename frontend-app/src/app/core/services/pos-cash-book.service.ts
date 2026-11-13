import { Injectable, inject } from '@angular/core';
import { CashActualBalance } from '../models/domain/cash-actual-balance.model';
import { CashAdjustment } from '../models/domain/cash-adjustment.model';
import { CashBookReport } from '../models/domain/cash-book-ledger.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { UserRole } from '../models/enums/user-role.enum';
import {
  buildCashBookLedger,
  buildDailySalesSummary,
  buildPaymentInvoices,
} from '../utils/cash-book-ledger.util';
import { mockFiguresForDays } from '../utils/cash-book-mock.util';
import {
  parseAdjustment,
  parseCountedAmount,
  validateDateRange,
} from '../utils/cash-book-validation.util';
import { isIsoDate } from '../utils/date.util';
import { AuthService } from './auth/auth.service';
import { ClockService } from './clock.service';
import { PermissionService } from './permission.service';
import { PosCashService, SaveOpeningResult } from './pos-cash.service';
import { PosFailureResult } from './pos-sale.service';
import { DAY_LOCKED_MESSAGE, PosWriteGuard, posFailure } from './pos-write-guard.service';

export type CashBookLoadResult = { ok: true; report: CashBookReport } | PosFailureResult;
export type CashBookWriteResult = { ok: true } | PosFailureResult;
export type AdjustmentWriteResult =
  { ok: true } | (PosFailureResult & { field?: 'amount' | 'note' });

export const CASH_BOOK_ADMIN_ONLY_MESSAGE =
  'Only an Admin can add actual balance, adjustments or opening balance.';
export const CASH_BOOK_VIEW_DENIED_MESSAGE = 'You do not have access to the cash book.';
const INVALID_DAY_MESSAGE = 'Choose a day that is today or earlier.';
const WRITE_SCOPE = 'pos-cash-book';

@Injectable({ providedIn: 'root' })
export class PosCashBookService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly clockService = inject(ClockService);
  private readonly cashService = inject(PosCashService);
  private readonly writeGuard = inject(PosWriteGuard);
  private adjustments: CashAdjustment[] = [];
  private actualBalances: CashActualBalance[] = [];
  private sequence = 0;

  canRecord(): boolean {
    return (
      this.authService.currentUser()?.role === UserRole.ADMIN &&
      this.permissionService.canWrite(ModuleKey.POS)
    );
  }

  async loadRange(from: string, to: string): Promise<CashBookLoadResult> {
    if (!this.permissionService.canView(ModuleKey.POS)) {
      return posFailure('denied', CASH_BOOK_VIEW_DENIED_MESSAGE);
    }
    const today = this.clockService.today();
    const check = validateDateRange(from, to, today);
    if (!check.ok) return posFailure('invalid', check.message);
    const figures = await this.cashService.cashRange(from, to);
    const mockDates = figures.activeDates.slice();
    if (from <= today && today <= to && !mockDates.includes(today)) mockDates.push(today);
    const adjustmentsCents = this.adjustments
      .filter(item => item.date >= from && item.date <= to)
      .reduce((total, item) => total + item.signedCents, 0);
    const ledger = buildCashBookLedger({
      openingCents: figures.openingCents,
      cashInvoicesCents: figures.cashInvoicesCents,
      cashDuesCents: figures.cashDuesCents,
      cashRefundsCents: figures.cashRefundsCents,
      adjustmentsCents,
      mock: mockFiguresForDays(mockDates),
      actualBalanceCents: this.actualFor(to)?.amountCents ?? null,
    });
    return {
      ok: true,
      report: {
        from,
        to,
        ledger,
        paymentInvoices: buildPaymentInvoices(figures.sales),
        dailySales: buildDailySalesSummary(figures.sales, figures.returns),
        toDayLocked: figures.toDayLocked,
      },
    };
  }

  saveActualBalance(date: string, amountText: string): Promise<CashBookWriteResult> {
    return this.writeGuard.run(WRITE_SCOPE, CASH_BOOK_ADMIN_ONLY_MESSAGE, async user => {
      if (!this.canRecord()) return posFailure('denied', CASH_BOOK_ADMIN_ONLY_MESSAGE);
      const refusal = await this.refuseDay(date);
      if (refusal !== null) return refusal;
      const parsed = parseCountedAmount(amountText);
      if (!parsed.ok) return posFailure('invalid', parsed.message);
      this.actualBalances = [
        ...this.actualBalances,
        {
          date,
          amountCents: parsed.cents,
          byUserId: user.id,
          by: user.displayName,
          at: this.clockService.now(),
        },
      ];
      return { ok: true as const };
    });
  }

  addAdjustment(date: string, amountText: string, note: string): Promise<AdjustmentWriteResult> {
    return this.writeGuard.run<AdjustmentWriteResult>(
      WRITE_SCOPE,
      CASH_BOOK_ADMIN_ONLY_MESSAGE,
      async user => {
        if (!this.canRecord()) return posFailure('denied', CASH_BOOK_ADMIN_ONLY_MESSAGE);
        const refusal = await this.refuseDay(date);
        if (refusal !== null) return refusal;
        const parsed = parseAdjustment(amountText, note);
        if (!parsed.ok) {
          const field = parsed.errors.amount === undefined ? 'note' : 'amount';
          const message = parsed.errors.amount ?? parsed.errors.note ?? '';
          return { ...posFailure('invalid', message), field };
        }
        this.sequence += 1;
        this.adjustments = [
          ...this.adjustments,
          {
            id: `cash-adj-${this.sequence}`,
            date,
            signedCents: parsed.signedCents,
            note: parsed.note,
            byUserId: user.id,
            by: user.displayName,
            at: this.clockService.now(),
          },
        ];
        return { ok: true as const };
      }
    );
  }

  async saveOpeningBalance(amountText: string, confirmChange: boolean): Promise<SaveOpeningResult> {
    if (!this.canRecord()) return posFailure('denied', CASH_BOOK_ADMIN_ONLY_MESSAGE);
    return this.cashService.saveOpening(amountText, confirmChange);
  }

  private actualFor(date: string): CashActualBalance | undefined {
    return this.actualBalances.filter(item => item.date === date).at(-1);
  }

  private async refuseDay(date: string): Promise<PosFailureResult | null> {
    if (!isIsoDate(date) || date > this.clockService.today()) {
      return posFailure('invalid', INVALID_DAY_MESSAGE);
    }
    const status = await this.cashService.status(date);
    return status.counterClosed ? posFailure('invalid', DAY_LOCKED_MESSAGE) : null;
  }
}
