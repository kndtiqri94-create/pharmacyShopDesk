import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import {
  Observable,
  combineLatest,
  defer,
  distinctUntilChanged,
  firstValueFrom,
  from,
  map,
  switchMap,
} from 'rxjs';
import { AttentionItem } from '../../../models/domain/attention-item.model';
import { SyncActionResult } from '../../../models/domain/sync-action-result.model';
import { SyncStatus } from '../../../models/domain/sync-status.model';
import { deriveSyncStatus } from '../../../utils/sync-status.util';
import { ConnectivityService } from '../../connectivity.service';
import { SyncDataService } from '../sync-data.service';
import { LocalDatabaseProvider } from './local-database.provider';
import { META_KEYS } from './local-meta';
import { OUTBOX_ENTITY_LABELS } from './sync/outbox-entities.const';
import { OutboxService } from './sync/outbox.service';
import { SyncEngineService, SyncRunResult } from './sync/sync-engine.service';
import { reasonText } from './sync/sync-reason-text';

interface SyncMeta {
  autoSyncEnabled: boolean;
  lastSyncAt: string | null;
}

@Injectable()
export class LocalSyncDataService extends SyncDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);
  private readonly outbox = inject(OutboxService);
  private readonly engine = inject(SyncEngineService);
  private readonly connectivity = inject(ConnectivityService);

  readonly stockTravelsAsMovements = true;

  readonly attentionItems$: Observable<readonly AttentionItem[]> = this.outbox.rejected$().pipe(
    map(entries =>
      entries.map(entry => ({
        id: entry.seq as number,
        what: OUTBOX_ENTITY_LABELS[entry.entity] ?? 'Change',
        madeAt: entry.createdAt,
        reason: reasonText(entry.reason),
      }))
    )
  );

  readonly status$: Observable<SyncStatus> = combineLatest([
    this.outbox.counts$(),
    this.meta$(),
    this.connectivity.online$,
    this.engine.running$,
    this.engine.lastError$,
  ]).pipe(
    map(([counts, meta, online, running, lastError]) =>
      deriveSyncStatus({
        online,
        running,
        pending: counts.pending,
        rejected: counts.rejected,
        lastSyncAt: meta.lastSyncAt,
        autoSyncEnabled: meta.autoSyncEnabled,
        lastError,
      })
    ),
    distinctUntilChanged((before, after) => JSON.stringify(before) === JSON.stringify(after))
  );

  getStatus(): Observable<SyncStatus> {
    return defer(() => from(firstValueFrom(this.status$)));
  }

  setAutoSync(enabled: boolean): Observable<SyncStatus> {
    return defer(async () => {
      await this.engine.setAutoSync(enabled);
      return firstValueFrom(this.status$);
    });
  }

  syncNow(): Observable<SyncActionResult> {
    return defer(() => from(this.exchange()));
  }

  backUpNow(): Observable<SyncActionResult> {
    return defer(() => from(this.exchange()));
  }

  exchangeBeforeProductUpdate(): Observable<boolean> {
    return defer(() => from(this.engine.flushOutbox()));
  }

  private async exchange(): Promise<SyncActionResult> {
    const result: SyncRunResult = await this.engine.runNow('manual');
    const counts = await this.outbox.counts();
    return {
      outcome: result.outcome,
      pendingChanges: counts.pending,
      attentionCount: counts.rejected,
    };
  }

  private meta$(): Observable<SyncMeta> {
    return defer(() => from(this.databaseProvider.ready())).pipe(
      switchMap(db =>
        from(
          liveQuery(async () => {
            const [auto, last] = await db.meta.bulkGet([
              META_KEYS.autoSyncEnabled,
              META_KEYS.lastSyncAt,
            ]);
            return {
              autoSyncEnabled: (auto?.value as boolean | undefined) ?? true,
              lastSyncAt: (last?.value as string | undefined) ?? null,
            };
          })
        )
      )
    );
  }
}
