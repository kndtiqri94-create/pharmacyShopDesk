import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';
import { Bill } from '../models/domain/bill.model';
import { HeldBill } from '../models/domain/held-bill.model';
import { Sale } from '../models/domain/sale.model';
import { AppUser } from '../models/domain/app-user.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { cloneValue } from '../utils/clone.util';
import { nextRecordId } from '../utils/document-number.util';
import { nextHoldNumber } from '../utils/invoice-number.util';
import { repriceHeldBill } from '../utils/pos-held-bill.util';
import { buildSale } from '../utils/pos-sale-build.util';
import { toPosSettings } from '../utils/pos-settings.util';
import { computeBillTotals } from '../utils/pos-totals.util';
import { MAX_BILL_LINES, validateHold } from '../utils/pos-validation.util';
import { AuthService } from './auth/auth.service';
import { ClockService } from './clock.service';
import { ProductDataService } from './data/product-data.service';
import { SalesDataService } from './data/sales-data.service';
import { SettingsDataService } from './data/settings-data.service';
import { PermissionService } from './permission.service';

export type PosFailure = 'denied' | 'busy' | 'invalid' | 'stock' | 'not-found';

export interface PosFailureResult {
  ok: false;
  reason: PosFailure;
  message: string;
}

export type SaveSaleResult = { ok: true; sale: Sale } | PosFailureResult;
export type HoldResult = { ok: true; held: HeldBill } | PosFailureResult;
export type DiscardResult = { ok: true } | PosFailureResult;
export type ResumeResult =
  { ok: true; bill: Bill; notes: string[]; autoHeld: HeldBill | null } | PosFailureResult;

export const MAX_HELD_BILLS = 50;

const DENIED_MESSAGE = 'You do not have access to sell at the till.';
const BUSY_MESSAGE = 'The last action is still finishing. Try again in a moment.';
const TOO_MANY_HELD = 'Too many bills are on hold. Resume or discard one first.';
const HELD_NOT_FOUND = 'That held bill is no longer there.';

function failure(reason: PosFailure, message: string): PosFailureResult {
  return { ok: false, reason, message };
}

@Injectable({ providedIn: 'root' })
export class PosSaleService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly clockService = inject(ClockService);
  private readonly productDataService = inject(ProductDataService);
  private readonly salesDataService = inject(SalesDataService);
  private readonly settingsDataService = inject(SettingsDataService);
  private busy = false;

  save(bill: Bill): Promise<SaveSaleResult> {
    return this.guarded(async user => {
      const [appSettings, customers, reps] = await Promise.all([
        firstValueFrom(this.settingsDataService.get()),
        firstValueFrom(this.salesDataService.getCustomers()),
        firstValueFrom(this.salesDataService.getReps()),
      ]);
      const blockExpired = appSettings.blockExpiredSales;
      const settings = toPosSettings(appSettings);
      return firstValueFrom(
        forkJoin([this.productDataService.getAll(), this.salesDataService.getSales()]).pipe(
          switchMap(([products, sales]): Observable<SaveSaleResult> => {
            const built = buildSale({
              bill,
              products,
              customers,
              reps,
              settings,
              blockExpired,
              today: this.clockService.today(),
              now: this.clockService.now(),
              existingSales: sales,
              cashier: { id: user.id, name: user.displayName },
            });
            if (!built.ok) return of(failure(built.reason, built.message));
            return this.productDataService.saveAll(built.products).pipe(
              switchMap(() => this.salesDataService.saveSale(built.sale)),
              map((sale): SaveSaleResult => ({ ok: true, sale }))
            );
          })
        )
      );
    });
  }

  hold(bill: Bill): Promise<HoldResult> {
    return this.guarded(async () => {
      const created = await this.createHeld(bill, null);
      return 'failure' in created ? created.failure : this.persistHeld(created.held);
    });
  }

  resume(heldId: string, current: Bill | null): Promise<ResumeResult> {
    return this.guarded(async () => {
      const heldBills = await firstValueFrom(this.salesDataService.getHeldBills());
      const stored = heldBills.find(candidate => candidate.id === heldId);
      if (stored === undefined) return failure('not-found', HELD_NOT_FOUND);
      const [appSettings, customers, reps, products] = await Promise.all([
        firstValueFrom(this.settingsDataService.get()),
        firstValueFrom(this.salesDataService.getCustomers()),
        firstValueFrom(this.salesDataService.getReps()),
        firstValueFrom(this.productDataService.getAll()),
      ]);
      const repriced = repriceHeldBill(stored.bill, {
        products,
        settings: toPosSettings(appSettings),
        customers,
        reps,
        today: this.clockService.today(),
        blockExpired: appSettings.blockExpiredSales,
      });
      let autoHeld: HeldBill | null = null;
      if (current !== null && current.lines.length > 0) {
        const created = await this.createHeld(current, heldId);
        if ('failure' in created) return created.failure;
        const persisted = await this.persistHeld(created.held);
        autoHeld = persisted.ok ? persisted.held : null;
      }
      await firstValueFrom(this.salesDataService.removeHeldBill(heldId));
      return { ok: true as const, bill: repriced.bill, notes: repriced.notes, autoHeld };
    });
  }

  discard(heldId: string): Promise<DiscardResult> {
    return this.guarded(async () => {
      const removed = await firstValueFrom(this.salesDataService.removeHeldBill(heldId));
      return removed ? { ok: true as const } : failure('not-found', HELD_NOT_FOUND);
    });
  }

  private async createHeld(
    bill: Bill,
    ignoredHeldId: string | null
  ): Promise<{ held: HeldBill } | { failure: PosFailureResult }> {
    const empty = validateHold(bill.lines.length);
    if (empty !== null) return { failure: failure('invalid', empty.message) };
    if (bill.lines.length > MAX_BILL_LINES) {
      return { failure: failure('invalid', 'The bill has too many items.') };
    }
    const [heldBills, customers] = await Promise.all([
      firstValueFrom(this.salesDataService.getHeldBills()),
      firstValueFrom(this.salesDataService.getCustomers()),
    ]);
    const others = heldBills.filter(candidate => candidate.id !== ignoredHeldId);
    if (others.length >= MAX_HELD_BILLS) return { failure: failure('invalid', TOO_MANY_HELD) };
    const customer = customers.find(candidate => candidate.id === bill.customerId);
    if (customer === undefined) {
      return { failure: failure('invalid', 'Choose a customer from the list.') };
    }
    const copy = cloneValue(bill);
    const totals = computeBillTotals(copy.lines, copy.billDiscount, {
      cashCents: 0,
      cardCents: 0,
      onlineCents: 0,
      creditSelected: false,
    });
    return {
      held: {
        id: nextRecordId(
          'held',
          heldBills.map(candidate => candidate.id)
        ),
        holdNo: nextHoldNumber(heldBills.map(candidate => candidate.holdNo)),
        heldAt: this.clockService.now(),
        customerName: customer.name,
        itemCount: copy.lines.length,
        totalCents: totals.totalCents,
        bill: copy,
      },
    };
  }

  private async persistHeld(held: HeldBill): Promise<HoldResult> {
    return { ok: true, held: await firstValueFrom(this.salesDataService.saveHeldBill(held)) };
  }

  private async guarded<T>(run: (user: AppUser) => Promise<T>): Promise<T | PosFailureResult> {
    const user = this.authService.currentUser();
    if (user === null || !this.permissionService.canWrite(ModuleKey.POS)) {
      return failure('denied', DENIED_MESSAGE);
    }
    if (this.busy) return failure('busy', BUSY_MESSAGE);
    this.busy = true;
    try {
      return await run(user);
    } finally {
      this.busy = false;
    }
  }
}
