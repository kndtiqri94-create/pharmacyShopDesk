import { Observable } from 'rxjs';
import {
  BestSeller,
  DailySalesPoint,
  TodaySalesSummary,
} from '../../models/domain/sales-summary.model';

export abstract class SalesDataService {
  abstract getDailySales(days: number): Observable<readonly DailySalesPoint[]>;
  abstract getTodaySummary(): Observable<TodaySalesSummary>;
  abstract getBestSellers(): Observable<readonly BestSeller[]>;
}
