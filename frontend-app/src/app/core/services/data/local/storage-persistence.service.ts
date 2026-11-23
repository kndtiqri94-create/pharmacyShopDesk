import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { LocalDbEvents } from './local-db-events.service';

export interface StorageManagerLike {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

export const STORAGE_MANAGER = new InjectionToken<StorageManagerLike | null>('STORAGE_MANAGER', {
  providedIn: 'root',
  factory: () => (typeof navigator === 'undefined' ? null : (navigator.storage ?? null)),
});

@Injectable({ providedIn: 'root' })
export class StoragePersistenceService {
  private readonly storageManager = inject(STORAGE_MANAGER);
  private readonly events = inject(LocalDbEvents);
  private readonly persistedSignal = signal<boolean | null>(null);

  readonly persisted = this.persistedSignal.asReadonly();
  readonly showWarning = computed(() => this.persistedSignal() === false);

  async request(): Promise<boolean> {
    const granted = await this.askBrowser();
    this.persistedSignal.set(granted);
    if (!granted) this.events.record('storage.persist.denied');
    return granted;
  }

  private async askBrowser(): Promise<boolean> {
    const manager = this.storageManager;
    if (manager?.persist === undefined) return false;
    try {
      if (manager.persisted !== undefined && (await manager.persisted())) return true;
      return await manager.persist();
    } catch {
      return false;
    }
  }
}
