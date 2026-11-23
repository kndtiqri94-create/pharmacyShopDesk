import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of } from 'rxjs';
import { AttentionItem } from '../../../models/domain/attention-item.model';
import { SyncActionResult } from '../../../models/domain/sync-action-result.model';
import { SyncStatus } from '../../../models/domain/sync-status.model';
import { cloneValue } from '../../../utils/clone.util';
import { SyncDataService } from '../sync-data.service';
import { SYNC_STATUS_SEED } from './seed/sync.seed';

@Injectable()
export class InMemorySyncDataService extends SyncDataService {
  private readonly statusSubject = new BehaviorSubject<SyncStatus>(cloneValue(SYNC_STATUS_SEED));

  readonly stockTravelsAsMovements = false;
  readonly attentionItems$: Observable<readonly AttentionItem[]> = of([]);
  readonly status$: Observable<SyncStatus> = this.statusSubject
    .asObservable()
    .pipe(map(status => cloneValue(status)));

  getStatus(): Observable<SyncStatus> {
    return of(cloneValue(this.statusSubject.value));
  }

  setAutoSync(enabled: boolean): Observable<SyncStatus> {
    this.statusSubject.next({ ...this.statusSubject.value, autoSyncEnabled: enabled });
    return of(cloneValue(this.statusSubject.value));
  }

  syncNow(): Observable<SyncActionResult> {
    return of(this.completed());
  }

  backUpNow(): Observable<SyncActionResult> {
    return of(this.completed());
  }

  exchangeBeforeProductUpdate(): Observable<boolean> {
    return of(true);
  }

  private completed(): SyncActionResult {
    const { pendingChanges, attentionCount } = this.statusSubject.value;
    return { outcome: 'completed', pendingChanges, attentionCount };
  }
}
