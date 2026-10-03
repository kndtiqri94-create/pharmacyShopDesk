import { SyncStatus } from '../../../../models/domain/sync-status.model';
import { SyncState } from '../../../../models/enums/sync-state.enum';

export const SYNC_STATUS_SEED: SyncStatus = {
  state: SyncState.ONLINE,
  pendingChanges: 0,
  minutesSinceSync: 2,
};
