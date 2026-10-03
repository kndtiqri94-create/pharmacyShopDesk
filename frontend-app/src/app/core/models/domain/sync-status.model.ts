import { SyncState } from '../enums/sync-state.enum';

export interface SyncStatus {
  state: SyncState;
  pendingChanges: number;
  minutesSinceSync: number;
}
