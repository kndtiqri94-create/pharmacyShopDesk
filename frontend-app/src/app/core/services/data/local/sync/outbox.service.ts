import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { Observable, defer, from, switchMap } from 'rxjs';
import { LocalDatabase } from '../local-database';
import { LocalDatabaseProvider } from '../local-database.provider';
import { OutboxEntry, SyncSeqRow, changeKey } from './outbox.model';

export interface OutboxCounts {
  pending: number;
  rejected: number;
}

export interface OutboxBatch {
  entries: OutboxEntry[];
  blocked: boolean;
}

@Injectable({ providedIn: 'root' })
export class OutboxService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  counts$(): Observable<OutboxCounts> {
    return this.live(async db => ({
      pending: await db.outbox.where('status').equals('pending').count(),
      rejected: await db.outbox.where('status').equals('rejected').count(),
    }));
  }

  rejected$(): Observable<OutboxEntry[]> {
    return this.live(db => db.outbox.where('status').equals('rejected').sortBy('seq'));
  }

  counts(): Promise<OutboxCounts> {
    return this.databaseProvider.run(async db => ({
      pending: await db.outbox.where('status').equals('pending').count(),
      rejected: await db.outbox.where('status').equals('rejected').count(),
    }));
  }

  nextBatch(limit: number): Promise<OutboxBatch> {
    return this.databaseProvider.run(async db => {
      const head = await db.outbox.where('status').equals('pending').sortBy('seq');
      const window = head.slice(0, limit);
      const seqs = await db.syncSeqs.bulkGet(
        window.map(entry => changeKey(entry.entity, entry.id))
      );
      return pickBatch(window, seqs, head.length > 0);
    });
  }

  baseSeqs(entries: readonly OutboxEntry[]): Promise<Map<string, number>> {
    return this.databaseProvider.run(async db => {
      const keys = entries.map(entry => changeKey(entry.entity, entry.id));
      const rows = await db.syncSeqs.bulkGet(keys);
      const result = new Map<string, number>();
      rows.forEach(row => {
        if (row) result.set(row.key, row.seq);
      });
      return result;
    });
  }

  bumpAttempts(seqs: readonly number[]): Promise<void> {
    return this.databaseProvider.run(async db => {
      await db.transaction('rw', db.outbox, async () => {
        for (const seq of seqs)
          await db.outbox
            .where('seq')
            .equals(seq)
            .modify(row => {
              row.attempts += 1;
            });
      });
    });
  }

  async resolveBatch(
    db: LocalDatabase,
    done: readonly OutboxEntry[],
    rejected: readonly { entry: OutboxEntry; reason: string }[]
  ): Promise<void> {
    await db.outbox.bulkDelete(done.map(entry => entry.seq as number));
    for (const { entry, reason } of rejected) {
      await db.outbox.update(entry.seq as number, { status: 'rejected', reason });
    }
  }

  private live<T>(query: (db: LocalDatabase) => T | Promise<T>): Observable<T> {
    return defer(() => from(this.databaseProvider.ready())).pipe(
      switchMap(db => from(liveQuery(() => query(db))))
    );
  }
}

export function pickBatch(
  window: readonly OutboxEntry[],
  seqs: readonly (SyncSeqRow | undefined)[],
  hasPending: boolean
): OutboxBatch {
  const seen = new Set<string>();
  const entries: OutboxEntry[] = [];
  for (const [index, entry] of window.entries()) {
    const key = changeKey(entry.entity, entry.id);
    const awaiting = seqs[index]?.awaiting === true;
    if (seen.has(key) || awaiting) break;
    seen.add(key);
    entries.push(entry);
  }
  return { entries, blocked: hasPending && entries.length === 0 };
}
