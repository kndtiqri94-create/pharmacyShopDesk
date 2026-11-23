import { Injectable } from '@angular/core';

export type LocalDbEventCode =
  | 'local-db.opened'
  | 'local-db.upgrade'
  | 'storage.persist.denied'
  | 'local-db.quota-exceeded'
  | 'sync.run.started'
  | 'sync.run.finished'
  | 'sync.push.failed'
  | 'sync.pull.applied'
  | 'sync.rejected'
  | 'connectivity.changed';

export interface LocalDbEvent {
  code: LocalDbEventCode;
  detail: string | number | null;
}

const MAX_EVENTS = 50;

@Injectable({ providedIn: 'root' })
export class LocalDbEvents {
  private readonly recorded: LocalDbEvent[] = [];

  record(code: LocalDbEventCode, detail: string | number | null = null): void {
    this.recorded.push({ code, detail });
    if (this.recorded.length > MAX_EVENTS) this.recorded.shift();
  }

  list(): readonly LocalDbEvent[] {
    return [...this.recorded];
  }
}
