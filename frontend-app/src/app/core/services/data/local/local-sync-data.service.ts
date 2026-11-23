import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of } from 'rxjs';
import { SyncStatus } from '../../../models/domain/sync-status.model';
import { cloneValue } from '../../../utils/clone.util';
import { SYNC_STATUS_SEED } from '../in-memory/seed/sync.seed';
import { SyncDataService } from '../sync-data.service';

@Injectable()
export class LocalSyncDataService extends SyncDataService {
  private readonly statusSubject = new BehaviorSubject<SyncStatus>(cloneValue(SYNC_STATUS_SEED));

  readonly status$: Observable<SyncStatus> = this.statusSubject
    .asObservable()
    .pipe(map(status => cloneValue(status)));

  getStatus(): Observable<SyncStatus> {
    return of(cloneValue(this.statusSubject.value));
  }

  setStatus(status: SyncStatus): Observable<SyncStatus> {
    this.statusSubject.next(cloneValue(status));
    return of(cloneValue(status));
  }
}
