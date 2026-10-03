import { Observable } from 'rxjs';
import { Supplier } from '../../models/domain/supplier.model';

export abstract class SupplierDataService {
  abstract getAll(): Observable<readonly Supplier[]>;
  abstract getById(id: string): Observable<Supplier | null>;
  abstract save(supplier: Supplier): Observable<Supplier>;
}
