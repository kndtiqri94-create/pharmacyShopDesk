import { Observable } from 'rxjs';
import { SyncStatus } from '../../models/domain/sync-status.model';

export abstract class SyncDataService {
  abstract readonly status$: Observable<SyncStatus>;
  abstract getStatus(): Observable<SyncStatus>;
  abstract setStatus(status: SyncStatus): Observable<SyncStatus>;
}
