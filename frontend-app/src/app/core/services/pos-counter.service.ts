import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppUser } from '../models/domain/app-user.model';
import { CounterReport } from '../models/domain/counter-report.model';
import { UserRole } from '../models/enums/user-role.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { posSalesTotalCents } from '../utils/pos-cash-ledger.util';
import {
  cleanCounterNote,
  counterDifferenceCents,
  validateCounterClose,
} from '../utils/pos-counter.util';
import { AuthService } from './auth/auth.service';
import { ClockService } from './clock.service';
import { DayLockedError } from './data/day-locked.error';
import { SalesDataService } from './data/sales-data.service';
import { UserDataService } from './data/user-data.service';
import { PosCashService } from './pos-cash.service';
import { PosRecordsService } from './pos-records.service';
import { PosFailureResult } from './pos-sale.service';
import { DAY_LOCKED_MESSAGE, PosWriteGuard, posFailure } from './pos-write-guard.service';

export const COUNTER_REGISTER_NAME = 'Counter 1';
export const SUPERVISOR_INVALID_MESSAGE =
  'Choose an active Admin or Manager as the supervisor who received the cash.';

export interface CounterSupervisor {
  id: string;
  displayName: string;
  role: UserRole;
}

export interface CounterPreview {
  date: string;
  cashierName: string;
  register: string;
  startTime: string | null;
  totalSalesCents: number;
  openingCents: number;
  cashInCents: number;
  cashOutCents: number;
  expectedCents: number;
  report: CounterReport | null;
  heldBillCount: number;
  supervisors: CounterSupervisor[];
}

export interface CloseCounterInput {
  countedText: string;
  handoverText: string;
  supervisorUserId: string | null;
  broughtForwardText: string | null;
  note: string;
  confirmed: boolean;
}

export type CloseCounterResult = { ok: true; report: CounterReport } | PosFailureResult;

const DENIED_MESSAGE = 'You do not have access to close the counter.';
const SUPERVISOR_ROLES: readonly UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];

function isSupervisor(user: AppUser | null): user is AppUser {
  return user !== null && user.status === UserStatus.ACTIVE && SUPERVISOR_ROLES.includes(user.role);
}

@Injectable({ providedIn: 'root' })
export class PosCounterService {
  private readonly clockService = inject(ClockService);
  private readonly authService = inject(AuthService);
  private readonly salesDataService = inject(SalesDataService);
  private readonly userDataService = inject(UserDataService);
  private readonly cashService = inject(PosCashService);
  private readonly recordsService = inject(PosRecordsService);
  private readonly writeGuard = inject(PosWriteGuard);

  async preview(): Promise<CounterPreview> {
    const today = this.clockService.today();
    const [view, held, records, users] = await Promise.all([
      this.cashService.view(today),
      firstValueFrom(this.salesDataService.getHeldBills()),
      this.recordsService.load(),
      firstValueFrom(this.userDataService.getAll()),
    ]);
    const startTime = await this.cashService.firstActivityTime(today);
    return {
      date: today,
      cashierName: this.authService.currentUser()?.displayName ?? '',
      register: COUNTER_REGISTER_NAME,
      startTime,
      totalSalesCents: posSalesTotalCents(records, today, view.status.report?.closedAt ?? null),
      openingCents: view.book.openingCents,
      cashInCents: view.book.cashInCents,
      cashOutCents: view.book.cashOutCents,
      expectedCents: view.book.expectedCents,
      report: view.status.report,
      heldBillCount: held.length,
      supervisors: users
        .filter(user => isSupervisor(user))
        .map(user => ({ id: user.id, displayName: user.displayName, role: user.role })),
    };
  }

  close(input: CloseCounterInput): Promise<CloseCounterResult> {
    return this.writeGuard.run('pos-cash', DENIED_MESSAGE, async user => {
      if (!input.confirmed) return posFailure('invalid', 'Confirm to close the counter.');
      const checked = validateCounterClose(input);
      if (!checked.ok) return posFailure('invalid', checked.message);
      const supervisorName = await this.resolveSupervisorName(checked.amounts.supervisorUserId);
      if (supervisorName === undefined) return posFailure('invalid', SUPERVISOR_INVALID_MESSAGE);
      const today = this.clockService.today();
      const view = await this.cashService.view(today);
      if (view.status.counterClosed) return posFailure('invalid', DAY_LOCKED_MESSAGE);
      const records = await this.recordsService.load();
      const endTime = this.clockService.now();
      const { amounts } = checked;
      const report: CounterReport = {
        date: today,
        register: COUNTER_REGISTER_NAME,
        startTime: await this.cashService.firstActivityTime(today),
        endTime,
        totalSalesCents: posSalesTotalCents(records, today, null),
        openingCents: view.book.openingCents,
        cashInCents: view.book.cashInCents,
        cashOutCents: view.book.cashOutCents,
        expectedCents: view.book.expectedCents,
        countedCents: amounts.countedCents,
        differenceCents: counterDifferenceCents(amounts.countedCents, view.book.expectedCents),
        handoverCents: amounts.handoverCents,
        supervisorUserId: amounts.supervisorUserId,
        supervisorName,
        broughtForwardCents: amounts.broughtForwardCents,
        unaccountedCents: amounts.unaccountedCents,
        note: cleanCounterNote(input.note),
        closedByUserId: user.id,
        closedBy: user.displayName,
        closedAt: endTime,
        locked: true,
      };
      try {
        const saved = await firstValueFrom(this.salesDataService.saveCounterReport(report));
        return { ok: true as const, report: saved };
      } catch (error) {
        if (error instanceof DayLockedError) return posFailure('invalid', DAY_LOCKED_MESSAGE);
        throw error;
      }
    });
  }

  private async resolveSupervisorName(
    supervisorUserId: string | null
  ): Promise<string | null | undefined> {
    if (supervisorUserId === null) return null;
    const supervisor = await firstValueFrom(this.userDataService.getById(supervisorUserId));
    return isSupervisor(supervisor) ? supervisor.displayName : undefined;
  }
}
