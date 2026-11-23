import { Injectable, InjectionToken, OnDestroy, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { generateDeviceCode } from '../../../utils/device-id.util';
import { isValidDeviceCode, setCurrentDeviceCode } from '../../../utils/device-identity.util';
import { ClockService } from '../../clock.service';
import { LocalDatabase } from './local-database';
import { LocalDbEvents } from './local-db-events.service';
import { META_KEYS, readMeta, writeMeta } from './local-meta';
import { seedLocalDatabase } from './seed/local-seed';
import { StorageQuotaExceededError, isQuotaExceeded } from './storage-quota-exceeded.error';
import { StoragePersistenceService } from './storage-persistence.service';

export const LOCAL_DATABASE_FACTORY = new InjectionToken<() => LocalDatabase>(
  'LOCAL_DATABASE_FACTORY',
  { providedIn: 'root', factory: () => () => new LocalDatabase() }
);

@Injectable({ providedIn: 'root' })
export class LocalDatabaseProvider implements OnDestroy {
  private readonly createDatabase = inject(LOCAL_DATABASE_FACTORY);
  private readonly persistence = inject(StoragePersistenceService);
  private readonly events = inject(LocalDbEvents);
  private readonly clockService = inject(ClockService);
  private database: LocalDatabase | null = null;
  private readyPromise: Promise<LocalDatabase> | null = null;

  ready(): Promise<LocalDatabase> {
    this.readyPromise ??= this.open().catch((error: unknown) => {
      this.readyPromise = null;
      throw error;
    });
    return this.readyPromise;
  }

  async run<T>(work: (db: LocalDatabase) => Promise<T>): Promise<T> {
    const db = await this.ready();
    try {
      return await work(db);
    } catch (error) {
      if (isQuotaExceeded(error)) {
        this.events.record('local-db.quota-exceeded');
        throw new StorageQuotaExceededError();
      }
      throw error;
    }
  }

  observe<T>(work: (db: LocalDatabase) => Promise<T>): Observable<T> {
    return defer(() => from(this.run(work)));
  }

  async setDeviceCode(code: string): Promise<void> {
    if (!isValidDeviceCode(code)) {
      throw new Error('A device code is 2 to 4 capital letters or digits.');
    }
    await this.run(db => writeMeta(db, META_KEYS.deviceCode, code));
    setCurrentDeviceCode(code);
  }

  ngOnDestroy(): void {
    this.database?.close();
    this.database = null;
    this.readyPromise = null;
    setCurrentDeviceCode(null);
  }

  private async open(): Promise<LocalDatabase> {
    const db = this.createDatabase();
    db.on('versionchange', () => db.close());
    await db.open();
    this.database = db;
    this.events.record('local-db.opened', db.verno);
    await seedLocalDatabase(db, this.clockService.now());
    await this.ensureDeviceCode(db);
    await this.recordSchemaVersion(db);
    this.persistence.request().catch(() => undefined);
    return db;
  }

  private async ensureDeviceCode(db: LocalDatabase): Promise<void> {
    const stored = await readMeta<string>(db, META_KEYS.deviceCode);
    const code = stored !== undefined && isValidDeviceCode(stored) ? stored : generateDeviceCode();
    if (code !== stored) await writeMeta(db, META_KEYS.deviceCode, code);
    setCurrentDeviceCode(code);
  }

  private async recordSchemaVersion(db: LocalDatabase): Promise<void> {
    const latest = db.verno;
    const previous = await readMeta<number>(db, META_KEYS.schemaVersion);
    if (previous === latest) return;
    if (previous !== undefined) this.events.record('local-db.upgrade', latest);
    await writeMeta(db, META_KEYS.schemaVersion, latest);
  }
}
