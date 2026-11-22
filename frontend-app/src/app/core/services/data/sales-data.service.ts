import { Observable } from 'rxjs';
import { CounterReport } from '../../models/domain/counter-report.model';
import { DayOpening } from '../../models/domain/day-opening.model';
import { DrawerSession } from '../../models/domain/drawer-session.model';
import { DuePayment } from '../../models/domain/due-payment.model';
import { HeldBill } from '../../models/domain/held-bill.model';
import { PosCustomer } from '../../models/domain/pos-customer.model';
import { ProductAdjustment } from '../../models/domain/product-adjustment.model';
import { Quotation } from '../../models/domain/quotation.model';
import { SaleReturn } from '../../models/domain/sale-return.model';
import { Sale } from '../../models/domain/sale.model';
import {
  BestSeller,
  DailySalesPoint,
  TodaySalesSummary,
} from '../../models/domain/sales-summary.model';
import { SalesRep } from '../../models/domain/sales-rep.model';

export interface OpeningDueBalance {
  customerId: string;
  owedCents: number;
}

export abstract class SalesDataService {
  abstract getDailySales(days: number): Observable<readonly DailySalesPoint[]>;
  abstract getTodaySummary(): Observable<TodaySalesSummary>;
  abstract getBestSellers(): Observable<readonly BestSeller[]>;
  abstract getSales(): Observable<readonly Sale[]>;
  abstract saveSale(sale: Sale): Observable<Sale>;
  abstract nextInvoiceNumber(): Observable<string>;
  abstract releaseInvoiceNumber(invoiceNo: string): Observable<void>;
  abstract getCustomers(): Observable<readonly PosCustomer[]>;
  abstract getReps(): Observable<readonly SalesRep[]>;
  abstract getHeldBills(): Observable<readonly HeldBill[]>;
  abstract saveHeldBill(heldBill: HeldBill): Observable<HeldBill>;
  abstract removeHeldBill(id: string): Observable<boolean>;
  abstract getReturns(): Observable<readonly SaleReturn[]>;
  abstract saveReturn(saleReturn: SaleReturn): Observable<SaleReturn>;
  abstract getQuotations(): Observable<readonly Quotation[]>;
  abstract saveQuotation(quotation: Quotation): Observable<Quotation>;
  abstract removeQuotation(id: string): Observable<boolean>;
  abstract markQuotationConverted(id: string, invoiceNo: string): Observable<Quotation | null>;
  abstract getDuePayments(): Observable<readonly DuePayment[]>;
  abstract saveDuePayment(payment: DuePayment): Observable<DuePayment>;
  abstract getOpeningDues(): Observable<readonly OpeningDueBalance[]>;
  abstract getDayOpening(date: string): Observable<DayOpening | null>;
  abstract saveDayOpening(opening: DayOpening): Observable<DayOpening>;
  abstract getDrawerSession(date: string): Observable<DrawerSession | null>;
  abstract saveDrawerSession(session: DrawerSession): Observable<DrawerSession>;
  abstract getCounterReport(date: string): Observable<CounterReport | null>;
  abstract saveCounterReport(report: CounterReport): Observable<CounterReport>;
  abstract getProductAdjustments(): Observable<readonly ProductAdjustment[]>;
  abstract saveProductAdjustment(adjustment: ProductAdjustment): Observable<ProductAdjustment>;
}
