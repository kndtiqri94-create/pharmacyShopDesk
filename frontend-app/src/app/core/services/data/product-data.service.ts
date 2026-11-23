import { Observable } from 'rxjs';
import { Product } from '../../models/domain/product.model';
import { StockChangeContext } from '../../models/domain/stock-movement.model';

export abstract class ProductDataService {
  abstract getAll(): Observable<readonly Product[]>;
  abstract getById(id: string): Observable<Product | null>;
  abstract save(product: Product, context?: StockChangeContext): Observable<Product>;
  abstract saveAll(
    products: readonly Product[],
    context?: StockChangeContext
  ): Observable<readonly Product[]>;
}
