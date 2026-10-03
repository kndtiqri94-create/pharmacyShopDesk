import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  BestSeller,
  DailySalesPoint,
  TodaySalesSummary,
} from '../../../models/domain/sales-summary.model';
import { cloneValue } from '../../../utils/clone.util';
import { SalesDataService } from '../sales-data.service';
import { BEST_SELLER_SEED, SALES_SEED } from './seed/sales.seed';

const MAX_SALES_DAYS = 30;
const DAYS_IN_WEEK = 7;

@Injectable()
export class InMemorySalesDataService extends SalesDataService {
  getDailySales(days: number): Observable<readonly DailySalesPoint[]> {
    const count = Math.min(Math.max(1, Math.floor(days) || 1), MAX_SALES_DAYS, SALES_SEED.length);
    return of(cloneValue(SALES_SEED.slice(-count)));
  }

  getTodaySummary(): Observable<TodaySalesSummary> {
    const today = SALES_SEED.at(-1)!;
    const lastWeek = SALES_SEED.at(-1 - DAYS_IN_WEEK)!;
    return of({
      date: today.date,
      salesCents: today.salesCents,
      profitCents: today.profitCents,
      bills: today.bills,
      comparedSalesCents: lastWeek.salesCents,
    });
  }

  getBestSellers(): Observable<readonly BestSeller[]> {
    return of(cloneValue(BEST_SELLER_SEED));
  }
}
