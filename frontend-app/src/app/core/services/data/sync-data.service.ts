import { Observable } from 'rxjs';
import { AttentionItem } from '../../models/domain/attention-item.model';
import { SyncActionResult } from '../../models/domain/sync-action-result.model';
import { SyncStatus } from '../../models/domain/sync-status.model';

export abstract class SyncDataService {
  abstract readonly status$: Observable<SyncStatus>;
  abstract readonly attentionItems$: Observable<readonly AttentionItem[]>;
  abstract readonly stockTravelsAsMovements: boolean;
  abstract getStatus(): Observable<SyncStatus>;
  abstract setAutoSync(enabled: boolean): Observable<SyncStatus>;
  abstract syncNow(): Observable<SyncActionResult>;
  abstract backUpNow(): Observable<SyncActionResult>;
  abstract exchangeBeforeProductUpdate(): Observable<boolean>;
}
