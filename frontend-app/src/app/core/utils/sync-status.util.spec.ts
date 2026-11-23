import { SyncState } from '../models/enums/sync-state.enum';
import { BACKOFF_CAP_MS, backoffDelayMs } from './sync-backoff.util';
import { SyncStatusInputs, describeSyncStatus, deriveSyncStatus } from './sync-status.util';

describe('sync status', () => {
  const base: SyncStatusInputs = {
    online: true,
    running: false,
    pending: 0,
    rejected: 0,
    lastSyncAt: null,
    autoSyncEnabled: true,
    lastError: null,
  };
  const state = (change: Partial<SyncStatusInputs>) =>
    deriveSyncStatus({ ...base, ...change }).state;

  it('is Online when nothing is waiting', () => {
    expect(state({})).toBe(SyncState.ONLINE);
  });

  it('is Offline when there is no connection', () => {
    expect(state({ online: false, pending: 2 })).toBe(SyncState.OFFLINE);
  });

  it('is Syncing while an exchange runs, ahead of every other state', () => {
    expect(state({ running: true, pending: 3, rejected: 1 })).toBe(SyncState.SYNCING);
  });

  it('is Needs attention when changes were refused, ahead of Offline', () => {
    expect(state({ rejected: 1 })).toBe(SyncState.NEEDS_ATTENTION);
    expect(state({ rejected: 1, online: false, pending: 4 })).toBe(SyncState.NEEDS_ATTENTION);
  });

  it('is not Syncing when the device is offline', () => {
    expect(state({ running: true, online: false })).toBe(SyncState.OFFLINE);
  });

  it('describes every state in plain words', () => {
    const text = (change: Partial<SyncStatusInputs>) =>
      describeSyncStatus(deriveSyncStatus({ ...base, ...change }));
    expect(text({})).toBe('Online');
    expect(text({ pending: 2 })).toBe('Online - 2 waiting to send');
    expect(text({ running: true, pending: 5 })).toBe('Syncing... 5 left');
    expect(text({ online: false })).toBe('Offline');
    expect(text({ online: false, pending: 1 })).toBe('Offline - 1 change waiting');
    expect(text({ online: false, pending: 3 })).toBe('Offline - 3 changes waiting');
    expect(text({ rejected: 2 })).toBe('Needs attention - 2');
  });
});

describe('backoffDelayMs', () => {
  const noJitter = () => 0;

  it('doubles from one second', () => {
    expect([1, 2, 3, 4].map(failures => backoffDelayMs(failures, noJitter))).toEqual([
      1000, 2000, 4000, 8000,
    ]);
  });

  it('never exceeds five minutes', () => {
    expect(backoffDelayMs(30, () => 0.99)).toBe(BACKOFF_CAP_MS);
  });

  it('adds jitter of at most a fifth', () => {
    expect(backoffDelayMs(1, () => 0.5)).toBe(1100);
    expect(backoffDelayMs(1, () => 0.999)).toBeLessThan(1200);
  });

  it('honours a longer retry-after from the server, still capped', () => {
    expect(backoffDelayMs(1, noJitter, 30_000)).toBe(30_000);
    expect(backoffDelayMs(1, noJitter, 900_000)).toBe(BACKOFF_CAP_MS);
  });
});
