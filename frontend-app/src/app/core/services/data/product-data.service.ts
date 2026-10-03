import { Observable } from 'rxjs';
import { Product } from '../../models/domain/product.model';

export abstract class ProductDataService {
  abstract getAll(): Observable<readonly Product[]>;
  abstract getById(id: string): Observable<Product | null>;
  abstract save(product: Product): Observable<Product>;
}
