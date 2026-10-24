import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { HeldBill } from '../../../models/domain/held-bill.model';
import { PosCustomer } from '../../../models/domain/pos-customer.model';
import { Sale } from '../../../models/domain/sale.model';
import { SalesRep } from '../../../models/domain/sales-rep.model';
import {
  BestSeller,
  DailySalesPoint,
  TodaySalesSummary,
} from '../../../models/domain/sales-summary.model';
import { cloneValue } from '../../../utils/clone.util';
import { addDays } from '../../../utils/date.util';
import { invoiceSequence, nextInvoiceNumber } from '../../../utils/invoice-number.util';
import { totalsForDate } from '../../../utils/sales-aggregate.util';
import { ClockService } from '../../clock.service';
import { SalesDataService } from '../sales-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { POS_CUSTOMER_SEED, SALES_REP_SEED } from './seed/pos.seed';
import { BEST_SELLER_SEED, SALES_SEED } from './seed/sales.seed';

const MAX_SALES_DAYS = 30;
const DAYS_IN_WEEK = 7;

@Injectable()
export class InMemorySalesDataService extends SalesDataService {
  private readonly clockService = inject(ClockService);
  private readonly sales = new InMemoryCollection<Sale>([]);
  private readonly heldBills = new InMemoryCollection<HeldBill>([]);
  private reservedInvoiceSequence = 0;

  getDailySales(days: number): Observable<readonly DailySalesPoint[]> {
    const count = Math.min(Math.max(1, Math.floor(days) || 1), MAX_SALES_DAYS, SALES_SEED.length);
    const saved = this.sales.all();
    return of(
      cloneValue(SALES_SEED.slice(-count)).map(point => {
        const extra = totalsForDate(saved, point.date);
        return {
          ...point,
          salesCents: point.salesCents + extra.salesCents,
          profitCents: point.profitCents + extra.profitCents,
          bills: point.bills + extra.bills,
        };
      })
    );
  }

  getTodaySummary(): Observable<TodaySalesSummary> {
    const today = this.clockService.today();
    const lastWeek = addDays(today, -DAYS_IN_WEEK);
    const saved = this.sales.all();
    const seedToday = SALES_SEED.find(point => point.date === today);
    const seedLastWeek = SALES_SEED.find(point => point.date === lastWeek);
    const todaySaved = totalsForDate(saved, today);
    return of({
      date: today,
      salesCents: (seedToday?.salesCents ?? 0) + todaySaved.salesCents,
      profitCents: (seedToday?.profitCents ?? 0) + todaySaved.profitCents,
      bills: (seedToday?.bills ?? 0) + todaySaved.bills,
      comparedSalesCents:
        (seedLastWeek?.salesCents ?? 0) + totalsForDate(saved, lastWeek).salesCents,
    });
  }

  getBestSellers(): Observable<readonly BestSeller[]> {
    return of(cloneValue(BEST_SELLER_SEED));
  }

  getSales(): Observable<readonly Sale[]> {
    return of(this.sales.all());
  }

  saveSale(sale: Sale): Observable<Sale> {
    this.reservedInvoiceSequence = Math.max(
      this.reservedInvoiceSequence,
      invoiceSequence(sale.invoiceNo)
    );
    return of(this.sales.upsert(sale));
  }

  nextInvoiceNumber(): Observable<string> {
    const used = [
      ...this.sales.all().map(sale => sale.invoiceNo),
      ...this.heldBills.all().map(held => held.bill.invoiceNo),
    ];
    const invoiceNo = nextInvoiceNumber(used, this.reservedInvoiceSequence);
    this.reservedInvoiceSequence = invoiceSequence(invoiceNo);
    return of(invoiceNo);
  }

  releaseInvoiceNumber(invoiceNo: string): Observable<void> {
    const sequence = invoiceSequence(invoiceNo);
    const inUse =
      this.sales.all().some(sale => sale.invoiceNo === invoiceNo) ||
      this.heldBills.all().some(held => held.bill.invoiceNo === invoiceNo);
    if (!inUse && sequence > 0 && sequence === this.reservedInvoiceSequence) {
      this.reservedInvoiceSequence = sequence - 1;
    }
    return of(undefined);
  }

  getCustomers(): Observable<readonly PosCustomer[]> {
    return of(cloneValue([...POS_CUSTOMER_SEED]));
  }

  getReps(): Observable<readonly SalesRep[]> {
    return of(cloneValue([...SALES_REP_SEED]));
  }

  getHeldBills(): Observable<readonly HeldBill[]> {
    return of(this.heldBills.all());
  }

  saveHeldBill(heldBill: HeldBill): Observable<HeldBill> {
    return of(this.heldBills.upsert(heldBill));
  }

  removeHeldBill(id: string): Observable<boolean> {
    return of(this.heldBills.remove(id));
  }
}
