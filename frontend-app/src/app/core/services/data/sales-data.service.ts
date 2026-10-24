import { Observable } from 'rxjs';
import { HeldBill } from '../../models/domain/held-bill.model';
import { PosCustomer } from '../../models/domain/pos-customer.model';
import { Sale } from '../../models/domain/sale.model';
import {
  BestSeller,
  DailySalesPoint,
  TodaySalesSummary,
} from '../../models/domain/sales-summary.model';
import { SalesRep } from '../../models/domain/sales-rep.model';

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
}
