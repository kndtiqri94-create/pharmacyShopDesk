import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
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
import { ReturnSettlement } from '../../../models/enums/return-settlement.enum';
import { SalePaymentMethod } from '../../../models/enums/sale-payment-method.enum';
import { QuotationStatus } from '../../../models/enums/quotation-status.enum';
import { SalesRep } from '../../../models/domain/sales-rep.model';
import {
  BestSeller,
  DailySalesPoint,
  TodaySalesSummary,
} from '../../../models/domain/sales-summary.model';
import { cloneValue } from '../../../utils/clone.util';
import { addDays } from '../../../utils/date.util';
import { invoiceSequence, nextInvoiceNumber } from '../../../utils/invoice-number.util';
import { dateOfTimestamp } from '../../../utils/pos-cash-ledger.util';
import { returnTotalsForDate, totalsForDate } from '../../../utils/sales-aggregate.util';
import { ClockService } from '../../clock.service';
import { DayLockedError } from '../day-locked.error';
import { OpeningDueBalance, SalesDataService } from '../sales-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { OPENING_DUE_SEED, POS_CUSTOMER_SEED, SALES_REP_SEED } from './seed/pos.seed';
import { BEST_SELLER_SEED, SALES_SEED } from './seed/sales.seed';

const MAX_SALES_DAYS = 30;
const DAYS_IN_WEEK = 7;

@Injectable()
export class InMemorySalesDataService extends SalesDataService {
  private readonly clockService = inject(ClockService);
  private readonly sales = new InMemoryCollection<Sale>([]);
  private readonly heldBills = new InMemoryCollection<HeldBill>([]);
  private readonly returns = new InMemoryCollection<SaleReturn>([]);
  private readonly quotations = new InMemoryCollection<Quotation>([]);
  private readonly duePayments = new InMemoryCollection<DuePayment>([]);
  private readonly adjustments = new InMemoryCollection<ProductAdjustment>([]);
  private readonly openings = new Map<string, DayOpening>();
  private readonly drawers = new Map<string, DrawerSession>();
  private readonly reports = new Map<string, CounterReport>();
  private reservedInvoiceSequence = 0;

  getDailySales(days: number): Observable<readonly DailySalesPoint[]> {
    const count = Math.min(Math.max(1, Math.floor(days) || 1), MAX_SALES_DAYS, SALES_SEED.length);
    const saved = this.sales.all();
    const returned = this.returns.all();
    return of(
      cloneValue(SALES_SEED.slice(-count)).map(point => {
        const extra = totalsForDate(saved, point.date);
        const back = returnTotalsForDate(returned, point.date);
        return {
          ...point,
          salesCents: point.salesCents + extra.salesCents - back.salesCents,
          profitCents: point.profitCents + extra.profitCents - back.profitCents,
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
    const returned = this.returns.all();
    const todayBack = returnTotalsForDate(returned, today);
    const lastWeekBack = returnTotalsForDate(returned, lastWeek);
    return of({
      date: today,
      salesCents: (seedToday?.salesCents ?? 0) + todaySaved.salesCents - todayBack.salesCents,
      profitCents: (seedToday?.profitCents ?? 0) + todaySaved.profitCents - todayBack.profitCents,
      bills: (seedToday?.bills ?? 0) + todaySaved.bills,
      comparedSalesCents:
        (seedLastWeek?.salesCents ?? 0) +
        totalsForDate(saved, lastWeek).salesCents -
        lastWeekBack.salesCents,
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

  getReturns(): Observable<readonly SaleReturn[]> {
    return of(this.returns.all());
  }

  saveReturn(saleReturn: SaleReturn): Observable<SaleReturn> {
    const day = dateOfTimestamp(saleReturn.createdAt);
    if (saleReturn.settlement === ReturnSettlement.CASH_REFUND && this.reports.has(day)) {
      return throwError(() => new DayLockedError(day));
    }
    return of(this.returns.upsert(saleReturn));
  }

  getQuotations(): Observable<readonly Quotation[]> {
    return of(this.quotations.all());
  }

  saveQuotation(quotation: Quotation): Observable<Quotation> {
    return of(this.quotations.upsert(quotation));
  }

  removeQuotation(id: string): Observable<boolean> {
    return of(this.quotations.remove(id));
  }

  markQuotationConverted(id: string, invoiceNo: string): Observable<Quotation | null> {
    const current = this.quotations.byId(id);
    if (current === null || current.status !== QuotationStatus.OPEN) return of(null);
    return of(
      this.quotations.upsert({
        ...current,
        status: QuotationStatus.CONVERTED,
        convertedInvoiceNo: invoiceNo,
      })
    );
  }

  getDuePayments(): Observable<readonly DuePayment[]> {
    return of(this.duePayments.all());
  }

  saveDuePayment(payment: DuePayment): Observable<DuePayment> {
    const day = dateOfTimestamp(payment.createdAt);
    if (payment.method === SalePaymentMethod.CASH && this.reports.has(day)) {
      return throwError(() => new DayLockedError(day));
    }
    return of(this.duePayments.upsert(payment));
  }

  getOpeningDues(): Observable<readonly OpeningDueBalance[]> {
    return of(cloneValue([...OPENING_DUE_SEED]));
  }

  getDayOpening(date: string): Observable<DayOpening | null> {
    return of(cloneValue(this.openings.get(date) ?? null));
  }

  saveDayOpening(opening: DayOpening): Observable<DayOpening> {
    if (this.reports.has(opening.date)) return throwError(() => new DayLockedError(opening.date));
    this.openings.set(opening.date, cloneValue(opening));
    return of(cloneValue(opening));
  }

  getDrawerSession(date: string): Observable<DrawerSession | null> {
    return of(cloneValue(this.drawers.get(date) ?? null));
  }

  saveDrawerSession(session: DrawerSession): Observable<DrawerSession> {
    this.drawers.set(session.date, cloneValue(session));
    return of(cloneValue(session));
  }

  getCounterReport(date: string): Observable<CounterReport | null> {
    return of(cloneValue(this.reports.get(date) ?? null));
  }

  saveCounterReport(report: CounterReport): Observable<CounterReport> {
    if (this.reports.has(report.date)) return throwError(() => new DayLockedError(report.date));
    this.reports.set(report.date, cloneValue(report));
    return of(cloneValue(report));
  }

  getProductAdjustments(): Observable<readonly ProductAdjustment[]> {
    return of(this.adjustments.all());
  }

  saveProductAdjustment(adjustment: ProductAdjustment): Observable<ProductAdjustment> {
    return of(this.adjustments.upsert(adjustment));
  }
}
