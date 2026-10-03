import { Observable } from 'rxjs';
import { Grn } from '../../models/domain/grn.model';

export abstract class GrnDataService {
  abstract getAll(): Observable<readonly Grn[]>;
  abstract getById(id: string): Observable<Grn | null>;
  abstract save(grn: Grn): Observable<Grn>;
}
