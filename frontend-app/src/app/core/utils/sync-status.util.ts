import { SyncLastErrorKind, SyncStatus } from '../models/domain/sync-status.model';
import { SyncState } from '../models/enums/sync-state.enum';

export interface SyncStatusInputs {
  online: boolean;
  running: boolean;
  pending: number;
  rejected: number;
  lastSyncAt: string | null;
  autoSyncEnabled: boolean;
  lastError: SyncLastErrorKind | null;
}

function pickState(inputs: SyncStatusInputs): SyncState {
  if (inputs.running && inputs.online) return SyncState.SYNCING;
  if (inputs.rejected > 0) return SyncState.NEEDS_ATTENTION;
  if (!inputs.online) return SyncState.OFFLINE;
  return SyncState.ONLINE;
}

export function deriveSyncStatus(inputs: SyncStatusInputs): SyncStatus {
  return {
    state: pickState(inputs),
    pendingChanges: inputs.pending,
    attentionCount: inputs.rejected,
    lastSyncAt: inputs.lastSyncAt,
    autoSyncEnabled: inputs.autoSyncEnabled,
    lastError: inputs.lastError,
  };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function describeSyncStatus(status: SyncStatus): string {
  if (status.state === SyncState.SYNCING) return `Syncing... ${status.pendingChanges} left`;
  if (status.state === SyncState.NEEDS_ATTENTION)
    return `Needs attention - ${status.attentionCount}`;
  if (status.state === SyncState.OFFLINE) {
    return status.pendingChanges === 0
      ? 'Offline'
      : `Offline - ${plural(status.pendingChanges, 'change')} waiting`;
  }
  if (status.pendingChanges > 0) return `Online - ${status.pendingChanges} waiting to send`;
  return 'Online';
}
