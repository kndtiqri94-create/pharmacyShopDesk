import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CounterReport } from '../../../models/domain/counter-report.model';
import { DayOpening } from '../../../models/domain/day-opening.model';
import { DrawerSession } from '../../../models/domain/drawer-session.model';
import { DuePayment } from '../../../models/domain/due-payment.model';
import { HeldBill } from '../../../models/domain/held-bill.model';
import { PosCustomer } from '../../../models/domain/pos-customer.model';
import { ProductAdjustment } from '../../../models/domain/product-adjustment.model';
import { Quotation } from '../../../models/domain/quotation.model';
import { SaleReturn } from '../../../models/domain/sale-return.model';
import { Sale } from '../../../models/domain/sale.model';
import { SalesRep } from '../../../models/domain/sales-rep.model';
import {
  BestSeller,
  DailySalesPoint,
  TodaySalesSummary,
} from '../../../models/domain/sales-summary.model';
import { QuotationStatus } from '../../../models/enums/quotation-status.enum';
import { ReturnSettlement } from '../../../models/enums/return-settlement.enum';
import { SalePaymentMethod } from '../../../models/enums/sale-payment-method.enum';
import { cloneValue } from '../../../utils/clone.util';
import { addDays } from '../../../utils/date.util';
import { invoiceSequence, nextInvoiceNumber } from '../../../utils/invoice-number.util';
import { dateOfTimestamp } from '../../../utils/pos-cash-ledger.util';
import { returnTotalsForDate, totalsForDate } from '../../../utils/sales-aggregate.util';
import { ClockService } from '../../clock.service';
import { DayLockedError } from '../day-locked.error';
import { BEST_SELLER_SEED, SALES_SEED } from '../in-memory/seed/sales.seed';
import { OpeningDueBalance, SalesDataService } from '../sales-data.service';
import { LocalCollection, stripRow } from './local-collection';
import { LocalDatabase } from './local-database';
import { LocalDatabaseProvider } from './local-database.provider';
import { META_KEYS, readMeta, writeMeta } from './local-meta';

const MAX_SALES_DAYS = 30;
const DAYS_IN_WEEK = 7;

@Injectable()
export class LocalSalesDataService extends SalesDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);
  private readonly clockService = inject(ClockService);

  getDailySales(days: number): Observable<readonly DailySalesPoint[]> {
    const count = Math.min(Math.max(1, Math.floor(days) || 1), MAX_SALES_DAYS, SALES_SEED.length);
    const points = cloneValue(SALES_SEED.slice(-count));
    const dates = points.map(point => point.date);
    return this.databaseProvider.observe(async db => {
      const saved = await this.salesOn(db, dates);
      const returned = await this.returnsOn(db, dates);
      return points.map(point => {
        const extra = totalsForDate(saved, point.date);
        const back = returnTotalsForDate(returned, point.date);
        return {
          ...point,
          salesCents: point.salesCents + extra.salesCents - back.salesCents,
          profitCents: point.profitCents + extra.profitCents - back.profitCents,
          bills: point.bills + extra.bills,
        };
      });
    });
  }

  getTodaySummary(): Observable<TodaySalesSummary> {
    const today = this.clockService.today();
    const lastWeek = addDays(today, -DAYS_IN_WEEK);
    const seedToday = SALES_SEED.find(point => point.date === today);
    const seedLastWeek = SALES_SEED.find(point => point.date === lastWeek);
    return this.databaseProvider.observe(async db => {
      const saved = await this.salesOn(db, [today, lastWeek]);
      const returned = await this.returnsOn(db, [today, lastWeek]);
      const todaySaved = totalsForDate(saved, today);
      const todayBack = returnTotalsForDate(returned, today);
      const lastWeekBack = returnTotalsForDate(returned, lastWeek);
      return {
        date: today,
        salesCents: (seedToday?.salesCents ?? 0) + todaySaved.salesCents - todayBack.salesCents,
        profitCents: (seedToday?.profitCents ?? 0) + todaySaved.profitCents - todayBack.profitCents,
        bills: (seedToday?.bills ?? 0) + todaySaved.bills,
        comparedSalesCents:
          (seedLastWeek?.salesCents ?? 0) +
          totalsForDate(saved, lastWeek).salesCents -
          lastWeekBack.salesCents,
      };
    });
  }

  getBestSellers(): Observable<readonly BestSeller[]> {
    return this.databaseProvider.observe(() => Promise.resolve(cloneValue(BEST_SELLER_SEED)));
  }

  getSales(): Observable<readonly Sale[]> {
    return this.databaseProvider.observe(db => new LocalCollection<Sale>(db.sales).all());
  }

  saveSale(sale: Sale): Observable<Sale> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.sales, db.meta, async () => {
        const reserved = (await readMeta<number>(db, META_KEYS.invoiceCounter)) ?? 0;
        await writeMeta(
          db,
          META_KEYS.invoiceCounter,
          Math.max(reserved, invoiceSequence(sale.invoiceNo))
        );
        return new LocalCollection<Sale>(db.sales).upsert(sale);
      })
    );
  }

  nextInvoiceNumber(): Observable<string> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.heldBills, db.meta, async () => {
        const held = await new LocalCollection<HeldBill>(db.heldBills).all();
        const reserved = (await readMeta<number>(db, META_KEYS.invoiceCounter)) ?? 0;
        const invoiceNo = nextInvoiceNumber(
          held.map(item => item.bill.invoiceNo),
          reserved
        );
        await writeMeta(db, META_KEYS.invoiceCounter, invoiceSequence(invoiceNo));
        return invoiceNo;
      })
    );
  }

  releaseInvoiceNumber(invoiceNo: string): Observable<void> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.sales, db.heldBills, db.meta, async () => {
        const sequence = invoiceSequence(invoiceNo);
        const reserved = (await readMeta<number>(db, META_KEYS.invoiceCounter)) ?? 0;
        if (sequence <= 0 || sequence !== reserved) return;
        const sold = await db.sales.where('invoiceNo').equals(invoiceNo).count();
        const held = await new LocalCollection<HeldBill>(db.heldBills).all();
        const inUse = sold > 0 || held.some(item => item.bill.invoiceNo === invoiceNo);
        if (!inUse) await writeMeta(db, META_KEYS.invoiceCounter, sequence - 1);
      })
    );
  }

  getCustomers(): Observable<readonly PosCustomer[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<PosCustomer>(db.posCustomers).all()
    );
  }

  getReps(): Observable<readonly SalesRep[]> {
    return this.databaseProvider.observe(db => new LocalCollection<SalesRep>(db.salesReps).all());
  }

  getHeldBills(): Observable<readonly HeldBill[]> {
    return this.databaseProvider.observe(db => new LocalCollection<HeldBill>(db.heldBills).all());
  }

  saveHeldBill(heldBill: HeldBill): Observable<HeldBill> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.heldBills, () =>
        new LocalCollection<HeldBill>(db.heldBills).upsert(heldBill)
      )
    );
  }

  removeHeldBill(id: string): Observable<boolean> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.heldBills, () =>
        new LocalCollection<HeldBill>(db.heldBills).remove(id)
      )
    );
  }

  getReturns(): Observable<readonly SaleReturn[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<SaleReturn>(db.saleReturns).all()
    );
  }

  saveReturn(saleReturn: SaleReturn): Observable<SaleReturn> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.saleReturns, db.counterReports, async () => {
        const day = dateOfTimestamp(saleReturn.createdAt);
        if (
          saleReturn.settlement === ReturnSettlement.CASH_REFUND &&
          (await this.isClosed(db, day))
        ) {
          throw new DayLockedError(day);
        }
        return new LocalCollection<SaleReturn>(db.saleReturns).upsert(saleReturn);
      })
    );
  }

  getQuotations(): Observable<readonly Quotation[]> {
    return this.databaseProvider.observe(db => new LocalCollection<Quotation>(db.quotations).all());
  }

  saveQuotation(quotation: Quotation): Observable<Quotation> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.quotations, () =>
        new LocalCollection<Quotation>(db.quotations).upsert(quotation)
      )
    );
  }

  removeQuotation(id: string): Observable<boolean> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.quotations, () =>
        new LocalCollection<Quotation>(db.quotations).remove(id)
      )
    );
  }

  markQuotationConverted(id: string, invoiceNo: string): Observable<Quotation | null> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.quotations, async () => {
        const collection = new LocalCollection<Quotation>(db.quotations);
        const current = await collection.byId(id);
        if (current === null || current.status !== QuotationStatus.OPEN) return null;
        return collection.upsert({
          ...current,
          status: QuotationStatus.CONVERTED,
          convertedInvoiceNo: invoiceNo,
        });
      })
    );
  }

  getDuePayments(): Observable<readonly DuePayment[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<DuePayment>(db.duePayments).all()
    );
  }

  saveDuePayment(payment: DuePayment): Observable<DuePayment> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.duePayments, db.counterReports, async () => {
        const day = dateOfTimestamp(payment.createdAt);
        if (payment.method === SalePaymentMethod.CASH && (await this.isClosed(db, day))) {
          throw new DayLockedError(day);
        }
        return new LocalCollection<DuePayment>(db.duePayments).upsert(payment);
      })
    );
  }

  getOpeningDues(): Observable<readonly OpeningDueBalance[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<OpeningDueBalance>(db.openingDues, 'customerId').all()
    );
  }

  getDayOpening(date: string): Observable<DayOpening | null> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<DayOpening>(db.dayOpenings, 'date').byId(date)
    );
  }

  saveDayOpening(opening: DayOpening): Observable<DayOpening> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.dayOpenings, db.counterReports, async () => {
        if (await this.isClosed(db, opening.date)) throw new DayLockedError(opening.date);
        return new LocalCollection<DayOpening>(db.dayOpenings, 'date').upsert(opening);
      })
    );
  }

  getDrawerSession(date: string): Observable<DrawerSession | null> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<DrawerSession>(db.drawerSessions, 'date').byId(date)
    );
  }

  saveDrawerSession(session: DrawerSession): Observable<DrawerSession> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.drawerSessions, () =>
        new LocalCollection<DrawerSession>(db.drawerSessions, 'date').upsert(session)
      )
    );
  }

  getCounterReport(date: string): Observable<CounterReport | null> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<CounterReport>(db.counterReports, 'date').byId(date)
    );
  }

  saveCounterReport(report: CounterReport): Observable<CounterReport> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.counterReports, async () => {
        if (await this.isClosed(db, report.date)) throw new DayLockedError(report.date);
        return new LocalCollection<CounterReport>(db.counterReports, 'date').upsert(report);
      })
    );
  }

  getProductAdjustments(): Observable<readonly ProductAdjustment[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<ProductAdjustment>(db.productAdjustments).all()
    );
  }

  saveProductAdjustment(adjustment: ProductAdjustment): Observable<ProductAdjustment> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.productAdjustments, () =>
        new LocalCollection<ProductAdjustment>(db.productAdjustments).upsert(adjustment)
      )
    );
  }

  private async isClosed(db: LocalDatabase, date: string): Promise<boolean> {
    return (await db.counterReports.get(date)) !== undefined;
  }

  private async salesOn(db: LocalDatabase, dates: readonly string[]): Promise<Sale[]> {
    const rows = await db.sales.where('date').anyOf(dates).sortBy('_ord');
    return rows.map(row => stripRow<Sale>(row));
  }

  private async returnsOn(db: LocalDatabase, dates: readonly string[]): Promise<SaleReturn[]> {
    const rows = await db.saleReturns.where('date').anyOf(dates).sortBy('_ord');
    return rows.map(row => stripRow<SaleReturn>(row));
  }
}
