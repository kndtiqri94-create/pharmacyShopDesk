import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, pairwise } from 'rxjs';
import { newId } from '../../../../utils/device-id.util';
import { currentDeviceCode } from '../../../../utils/device-identity.util';
import { backoffDelayMs } from '../../../../utils/sync-backoff.util';
import { SYNC_INTERVAL_MS } from '../../../api-config';
import { ClockService } from '../../../clock.service';
import { ConnectivityService } from '../../../connectivity.service';
import { LocalDatabase } from '../local-database';
import { LocalDatabaseProvider } from '../local-database.provider';
import { LocalDbEvents } from '../local-db-events.service';
import { META_KEYS, readMeta, writeMeta } from '../local-meta';
import { OutboxEntry, changeKey } from './outbox.model';
import { OutboxService } from './outbox.service';
import { SyncApplyService } from './sync-apply.service';
import { PUSH_BATCH_SIZE, PushChange, PushResult } from './sync-transport.model';
import { SyncTransportService } from './sync-transport.service';

export type SyncTrigger = 'start' | 'timer' | 'reconnect' | 'manual' | 'product-update' | 'toggle';
export type SyncRunOutcome = 'completed' | 'offline' | 'unauthorised' | 'failed' | 'busy';
export type SyncLastError = 'unauthorised' | 'unreachable' | null;

export interface SyncRunResult {
  outcome: SyncRunOutcome;
  pushed: number;
  rejected: number;
  pulled: number;
}

interface StepFailure {
  kind: 'failed';
  failure: 'transient' | 'unauthorised' | 'fatal';
  network: boolean;
  retryAfterMs: number;
}

interface PushSummary {
  pushed: number;
  rejected: number;
  serverWins: boolean;
}

type PushOutcome = { kind: 'ok'; summary: PushSummary } | StepFailure;
type PullOutcome = { kind: 'ok'; count: number } | StepFailure;

const LOCK_PREFIX = 'shopdesk-sync';
const LEASE_MS = 2 * 60 * 1000;
const NO_WORK: SyncRunResult = { outcome: 'failed', pushed: 0, rejected: 0, pulled: 0 };

function toPushChange(entry: OutboxEntry, baseSeqs: ReadonlyMap<string, number>): PushChange {
  const change: PushChange = {
    changeId: entry.changeId,
    entity: entry.entity,
    op: entry.op,
    id: entry.id,
  };
  if (entry.op === 'put') change.data = entry.data;
  if (entry.entity !== 'stockMovements') {
    change.baseSeq = baseSeqs.get(changeKey(entry.entity, entry.id)) ?? null;
  }
  return change;
}

@Injectable({ providedIn: 'root' })
export class SyncEngineService implements OnDestroy {
  private readonly databaseProvider = inject(LocalDatabaseProvider);
  private readonly outbox = inject(OutboxService);
  private readonly transport = inject(SyncTransportService);
  private readonly applyService = inject(SyncApplyService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly events = inject(LocalDbEvents);
  private readonly clockService = inject(ClockService);
  private readonly intervalMs = inject(SYNC_INTERVAL_MS);
  private readonly owner = newId();
  private readonly runningSubject = new BehaviorSubject<boolean>(false);
  private readonly lastErrorSubject = new BehaviorSubject<SyncLastError>(null);
  private inFlight: Promise<SyncRunResult> | null = null;
  private failures = 0;
  private nextAttemptAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private reconnectWatch: Subscription | null = null;

  readonly running$: Observable<boolean> = this.runningSubject.asObservable();
  readonly lastError$: Observable<SyncLastError> = this.lastErrorSubject.asObservable();

  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.tick().catch(() => undefined), this.intervalMs);
    this.reconnectWatch = this.connectivity.online$.pipe(pairwise()).subscribe(([before, now]) => {
      if (before || !now) return;
      this.failures = 0;
      this.nextAttemptAt = 0;
      this.runAutomatic('reconnect').catch(() => undefined);
    });
    this.runAutomatic('start').catch(() => undefined);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.reconnectWatch?.unsubscribe();
    this.reconnectWatch = null;
  }

  ngOnDestroy(): void {
    this.stop();
  }

  isAutoSyncEnabled(): Promise<boolean> {
    return this.databaseProvider.run(
      async db => (await readMeta<boolean>(db, META_KEYS.autoSyncEnabled)) ?? true
    );
  }

  async setAutoSync(enabled: boolean): Promise<void> {
    await this.databaseProvider.run(db => writeMeta(db, META_KEYS.autoSyncEnabled, enabled));
    if (enabled) this.runAutomatic('toggle').catch(() => undefined);
  }

  runNow(trigger: SyncTrigger): Promise<SyncRunResult> {
    this.inFlight ??= this.run(trigger).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async flushOutbox(): Promise<boolean> {
    return (await this.runNow('product-update')).outcome === 'completed';
  }

  private async tick(): Promise<void> {
    if (Date.now() < this.nextAttemptAt) return;
    await this.runAutomatic('timer');
  }

  private async runAutomatic(trigger: SyncTrigger): Promise<void> {
    if (!this.connectivity.canAttempt() || !(await this.isAutoSyncEnabled())) return;
    await this.runNow(trigger);
  }

  private async run(trigger: SyncTrigger): Promise<SyncRunResult> {
    if (!this.connectivity.canAttempt()) return { ...NO_WORK, outcome: 'offline' };
    this.runningSubject.next(true);
    try {
      const db = await this.databaseProvider.ready();
      const result = await this.withLock(db, () => this.exchange(db, trigger));
      return result ?? { ...NO_WORK, outcome: 'busy' };
    } catch {
      this.recordFailure('transient', false, 0);
      return NO_WORK;
    } finally {
      this.runningSubject.next(false);
    }
  }

  private async exchange(db: LocalDatabase, trigger: SyncTrigger): Promise<SyncRunResult> {
    const startedAt = Date.now();
    this.events.record('sync.run.started', trigger);
    const pushed = await this.pushAll(db);
    if (pushed.kind === 'failed') return this.failed(pushed);
    const pulled = await this.pullAll(db, pushed.summary.serverWins);
    if (pulled.kind === 'failed') return this.failed(pulled);
    await this.clearAwaiting(db);
    await writeMeta(db, META_KEYS.lastSyncAt, this.clockService.now());
    this.succeeded();
    const { pushed: sent, rejected } = pushed.summary;
    const elapsed = Date.now() - startedAt;
    this.events.record(
      'sync.run.finished',
      `pushed=${sent},rejected=${rejected},pulled=${pulled.count},ms=${elapsed}`
    );
    return { outcome: 'completed', pushed: sent, rejected, pulled: pulled.count };
  }

  private async pushAll(db: LocalDatabase): Promise<PushOutcome> {
    const total: PushSummary = { pushed: 0, rejected: 0, serverWins: false };
    for (;;) {
      const batch = await this.outbox.nextBatch(PUSH_BATCH_SIZE);
      if (batch.entries.length === 0) {
        if (!batch.blocked) return { kind: 'ok', summary: total };
        const settled = await this.settleAwaiting(db);
        if (settled !== null) return settled;
        continue;
      }
      const outcome = await this.pushBatch(db, batch.entries);
      if (outcome.kind === 'failed') return outcome;
      total.pushed += outcome.summary.pushed;
      total.rejected += outcome.summary.rejected;
      total.serverWins ||= outcome.summary.serverWins;
    }
  }

  private async settleAwaiting(db: LocalDatabase): Promise<StepFailure | null> {
    const pulled = await this.pullAll(db, false);
    if (pulled.kind === 'failed') return pulled;
    await this.clearAwaiting(db);
    return null;
  }

  private async clearAwaiting(db: LocalDatabase): Promise<void> {
    await db.syncSeqs
      .filter(row => row.awaiting === true)
      .modify(row => {
        delete row.awaiting;
      });
  }

  private async pushBatch(
    db: LocalDatabase,
    entries: readonly OutboxEntry[]
  ): Promise<PushOutcome> {
    const device = currentDeviceCode();
    if (device === null)
      return { kind: 'failed', failure: 'fatal', network: false, retryAfterMs: 0 };
    const baseSeqs = await this.outbox.baseSeqs(entries);
    const changes = entries.map(entry => toPushChange(entry, baseSeqs));
    const outcome = await this.transport.push(device, changes);
    if (outcome.kind === 'failed') {
      await this.outbox.bumpAttempts(entries.map(entry => entry.seq as number));
      return outcome;
    }
    this.connectivity.reportSuccess();
    return { kind: 'ok', summary: await this.recordResults(db, entries, outcome.body) };
  }

  private recordResults(
    db: LocalDatabase,
    entries: readonly OutboxEntry[],
    results: readonly PushResult[]
  ): Promise<PushSummary> {
    return db.transaction('rw', db.outbox, db.syncSeqs, async () => {
      const done: OutboxEntry[] = [];
      const refused: { entry: OutboxEntry; reason: string }[] = [];
      let serverWins = false;
      for (const [index, entry] of entries.entries()) {
        const result = results[index];
        if (result.status === 'rejected') {
          refused.push({ entry, reason: result.reason ?? 'unknown' });
          this.events.record('sync.rejected', result.reason ?? 'unknown');
          continue;
        }
        done.push(entry);
        await this.trackServerSeq(db, entry, result);
        serverWins ||= result.reason === 'server_wins';
      }
      await this.outbox.resolveBatch(db, done, refused);
      return { pushed: done.length, rejected: refused.length, serverWins };
    });
  }

  private async trackServerSeq(
    db: LocalDatabase,
    entry: OutboxEntry,
    result: PushResult
  ): Promise<void> {
    if (entry.entity === 'stockMovements' || result.status !== 'accepted') return;
    const key = changeKey(entry.entity, entry.id);
    if (entry.op === 'delete') {
      await db.syncSeqs.delete(key);
      return;
    }
    const known = await db.syncSeqs.get(key);
    await db.syncSeqs.put({ key, seq: known?.seq ?? 0, awaiting: true });
  }

  private async pullAll(db: LocalDatabase, fromStart: boolean): Promise<PullOutcome> {
    let cursor = fromStart ? 0 : ((await readMeta<number>(db, META_KEYS.pullCursor)) ?? 0);
    let count = 0;
    for (;;) {
      const outcome = await this.transport.pull(cursor);
      if (outcome.kind === 'failed') return outcome;
      this.connectivity.reportSuccess();
      const summary = await this.applyService.applyPage(db, outcome.body);
      count += summary.applied;
      this.events.record(
        'sync.pull.applied',
        `applied=${summary.applied},skipped=${summary.skipped}`
      );
      const advanced = outcome.body.nextCursor > cursor;
      cursor = outcome.body.nextCursor;
      if (!outcome.body.hasMore || !advanced) return { kind: 'ok', count };
    }
  }

  private failed(step: StepFailure): SyncRunResult {
    this.recordFailure(step.failure, step.network, step.retryAfterMs);
    return { ...NO_WORK, outcome: step.failure === 'unauthorised' ? 'unauthorised' : 'failed' };
  }

  private recordFailure(failure: string, network: boolean, retryAfterMs: number): void {
    if (network) this.connectivity.reportNetworkFailure();
    this.lastErrorSubject.next(failure === 'unauthorised' ? 'unauthorised' : 'unreachable');
    this.failures += 1;
    const delay = backoffDelayMs(this.failures, Math.random, retryAfterMs);
    this.nextAttemptAt = Date.now() + delay;
    this.events.record(
      'sync.push.failed',
      `kind=${failure},attempt=${this.failures},nextDelayMs=${delay}`
    );
  }

  private succeeded(): void {
    this.failures = 0;
    this.nextAttemptAt = 0;
    this.lastErrorSubject.next(null);
    this.connectivity.reportSuccess();
  }

  private async withLock<T>(db: LocalDatabase, work: () => Promise<T>): Promise<T | null> {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (locks) {
      const name = `${LOCK_PREFIX}:${db.name}`;
      return locks.request(name, { ifAvailable: true }, lock => (lock ? work() : null));
    }
    if (!(await this.takeLease(db))) return null;
    try {
      return await work();
    } finally {
      await this.releaseLease(db);
    }
  }

  private takeLease(db: LocalDatabase): Promise<boolean> {
    return db.transaction('rw', db.meta, async () => {
      const lease = await readMeta<{ owner: string; expiresAt: number }>(db, META_KEYS.syncLease);
      if (lease && lease.owner !== this.owner && lease.expiresAt > Date.now()) return false;
      const next = { owner: this.owner, expiresAt: Date.now() + LEASE_MS };
      await writeMeta(db, META_KEYS.syncLease, next);
      return true;
    });
  }

  private async releaseLease(db: LocalDatabase): Promise<void> {
    const lease = await readMeta<{ owner: string }>(db, META_KEYS.syncLease);
    if (lease?.owner === this.owner) await db.meta.delete(META_KEYS.syncLease);
  }
}
