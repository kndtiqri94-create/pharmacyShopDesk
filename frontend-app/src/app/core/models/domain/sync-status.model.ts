import { SyncState } from '../enums/sync-state.enum';

export type SyncLastErrorKind = 'unauthorised' | 'unreachable';

export interface SyncStatus {
  state: SyncState;
  pendingChanges: number;
  attentionCount: number;
  lastSyncAt: string | null;
  autoSyncEnabled: boolean;
  lastError?: SyncLastErrorKind | null;
}
