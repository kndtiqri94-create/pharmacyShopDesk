import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CounterReport } from '../models/domain/counter-report.model';
import { SaleReturn } from '../models/domain/sale-return.model';
import { Sale } from '../models/domain/sale.model';
import { CashEntryKind } from '../models/enums/cash-entry-kind.enum';
import { DayOpening } from '../models/domain/day-opening.model';
import { DrawerSession } from '../models/domain/drawer-session.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { datesInRange } from '../utils/cash-book-validation.util';
import { addDays } from '../utils/date.util';
import { openingChanged, parseOpeningBalance } from '../utils/opening-balance.util';
import {
  CashBook,
  buildCashEntries,
  computeCashBook,
  dateOfTimestamp,
  firstActivityTimestamp,
  hasDayActivity,
  sumCashEntries,
} from '../utils/pos-cash-ledger.util';
import { ClockService } from './clock.service';
import { DayLockedError } from './data/day-locked.error';
import { SalesDataService } from './data/sales-data.service';
import { PermissionService } from './permission.service';
import { PosRecordsService } from './pos-records.service';
import { PosFailureResult } from './pos-sale.service';
import { DAY_LOCKED_MESSAGE, PosWriteGuard, posFailure } from './pos-write-guard.service';

export interface DayStatus {
  date: string;
  opening: DayOpening | null;
  drawer: DrawerSession | null;
  report: CounterReport | null;
  counterClosed: boolean;
  drawerEnded: boolean;
}

export interface CashBookView {
  status: DayStatus;
  book: CashBook;
  readOnly: boolean;
}

export interface CashRangeFigures {
  openingCents: number;
  cashInvoicesCents: number;
  cashDuesCents: number;
  cashRefundsCents: number;
  activeDates: string[];
  sales: Sale[];
  returns: SaleReturn[];
  toDayLocked: boolean;
}

export interface BroughtForward {
  cents: number;
  fromDate: string;
}

export type SaveOpeningResult = { ok: true; opening: DayOpening } | PosFailureResult;
export type EndDrawerResult = { ok: true; session: DrawerSession } | PosFailureResult;

const DENIED_MESSAGE = 'You do not have access to change the till cash.';
const BROUGHT_FORWARD_LOOKBACK_DAYS = 31;

@Injectable({ providedIn: 'root' })
export class PosCashService {
  private readonly clockService = inject(ClockService);
  private readonly salesDataService = inject(SalesDataService);
  private readonly recordsService = inject(PosRecordsService);
  private readonly writeGuard = inject(PosWriteGuard);
  private readonly permissionService = inject(PermissionService);

  async status(date: string): Promise<DayStatus> {
    const [opening, drawer, report] = await Promise.all([
      firstValueFrom(this.salesDataService.getDayOpening(date)),
      firstValueFrom(this.salesDataService.getDrawerSession(date)),
      firstValueFrom(this.salesDataService.getCounterReport(date)),
    ]);
    return {
      date,
      opening,
      drawer,
      report,
      counterClosed: report !== null,
      drawerEnded: (drawer?.endedAt ?? null) !== null,
    };
  }

  async view(date: string): Promise<CashBookView> {
    const [status, records] = await Promise.all([this.status(date), this.recordsService.load()]);
    const entries = buildCashEntries(records, date, status.report?.closedAt ?? null);
    const openingCents = status.report?.openingCents ?? status.opening?.amountCents ?? 0;
    return {
      status,
      book: computeCashBook(openingCents, entries),
      readOnly: date !== this.clockService.today() || status.counterClosed,
    };
  }

  async cashRange(from: string, to: string): Promise<CashRangeFigures> {
    const dates = datesInRange(from, to);
    const records = await this.recordsService.load();
    const statuses = await Promise.all(dates.map(date => this.status(date)));
    const entries = statuses.flatMap(status =>
      buildCashEntries(records, status.date, status.report?.closedAt ?? null)
    );
    const first = statuses[0];
    const inRange = (timestamp: string): boolean => {
      const day = dateOfTimestamp(timestamp);
      return day >= from && day <= to;
    };
    return {
      openingCents: first?.report?.openingCents ?? first?.opening?.amountCents ?? 0,
      cashInvoicesCents: sumCashEntries(entries, CashEntryKind.SALE_CASH),
      cashDuesCents: sumCashEntries(entries, CashEntryKind.DUE_PAYMENT),
      cashRefundsCents: sumCashEntries(entries, CashEntryKind.RETURN_REFUND),
      activeDates: statuses
        .filter(status => hasDayActivity(records, status.date, status.opening !== null))
        .map(status => status.date),
      sales: records.sales.filter(sale => inRange(sale.createdAt)),
      returns: records.returns.filter(item => inRange(item.createdAt)),
      toDayLocked: statuses.at(-1)?.counterClosed ?? false,
    };
  }

  async firstActivityTime(date: string): Promise<string | null> {
    const [status, records] = await Promise.all([this.status(date), this.recordsService.load()]);
    return firstActivityTimestamp(records, date, status.opening);
  }

  async broughtForwardFor(date: string): Promise<BroughtForward | null> {
    if (!this.permissionService.canView(ModuleKey.POS)) return null;
    for (let back = 1; back <= BROUGHT_FORWARD_LOOKBACK_DAYS; back += 1) {
      const previous = addDays(date, -back);
      const report = await firstValueFrom(this.salesDataService.getCounterReport(previous));
      if (report !== null) return { cents: report.broughtForwardCents, fromDate: report.date };
    }
    return null;
  }

  saveOpening(amountText: string, confirmChange: boolean): Promise<SaveOpeningResult> {
    return this.writeGuard.run('pos-cash', DENIED_MESSAGE, async user => {
      const parsed = parseOpeningBalance(amountText);
      if (!parsed.ok) return posFailure('invalid', parsed.message);
      const today = this.clockService.today();
      const status = await this.status(today);
      if (status.counterClosed) return posFailure('invalid', DAY_LOCKED_MESSAGE);
      const now = this.clockService.now();
      const existing = status.opening;
      if (existing !== null && !openingChanged(existing.amountCents, parsed.cents)) {
        return posFailure('invalid', 'The opening balance is already that amount.');
      }
      if (existing !== null && !confirmChange) {
        return posFailure(
          'invalid',
          'An opening balance is already saved. Confirm the change to replace it.'
        );
      }
      const opening: DayOpening =
        existing === null
          ? {
              date: today,
              amountCents: parsed.cents,
              setByUserId: user.id,
              setBy: user.displayName,
              setAt: now,
              changeLog: [],
            }
          : {
              ...existing,
              amountCents: parsed.cents,
              changeLog: [
                ...existing.changeLog,
                {
                  oldCents: existing.amountCents,
                  newCents: parsed.cents,
                  byUserId: user.id,
                  by: user.displayName,
                  at: now,
                },
              ],
            };
      try {
        const saved = await firstValueFrom(this.salesDataService.saveDayOpening(opening));
        return { ok: true as const, opening: saved };
      } catch (error) {
        if (error instanceof DayLockedError) return posFailure('invalid', DAY_LOCKED_MESSAGE);
        throw error;
      }
    });
  }

  endDrawer(): Promise<EndDrawerResult> {
    return this.writeGuard.run('pos-cash', DENIED_MESSAGE, async user => {
      const today = this.clockService.today();
      const current = await firstValueFrom(this.salesDataService.getDrawerSession(today));
      if ((current?.endedAt ?? null) !== null) {
        return posFailure('invalid', 'The drawer has already been ended for today.');
      }
      const session: DrawerSession = {
        date: today,
        endedAt: this.clockService.now(),
        endedByUserId: user.id,
        endedBy: user.displayName,
      };
      const saved = await firstValueFrom(this.salesDataService.saveDrawerSession(session));
      return { ok: true as const, session: saved };
    });
  }
}
