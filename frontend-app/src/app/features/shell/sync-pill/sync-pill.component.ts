import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SyncStatus } from '../../../core/models/domain/sync-status.model';
import { SyncState } from '../../../core/models/enums/sync-state.enum';
import { SyncDataService } from '../../../core/services/data/sync-data.service';
import { SYNC_STATE_DISPLAY } from '../../../core/utils/status-display.util';

export function describeSyncStatus(status: SyncStatus): string {
  if (status.state === SyncState.SYNCING) return 'Syncing…';
  if (status.state === SyncState.OFFLINE) {
    const noun = status.pendingChanges === 1 ? 'change' : 'changes';
    return `Offline · ${status.pendingChanges} ${noun} waiting`;
  }
  return `Synced · ${status.minutesSinceSync} min ago`;
}

@Component({
  selector: 'app-sync-pill',
  templateUrl: './sync-pill.component.html',
  styleUrl: './sync-pill.component.scss',
})
export class SyncPillComponent {
  private readonly syncDataService = inject(SyncDataService);

  protected readonly status = toSignal(this.syncDataService.status$);
  protected readonly text = computed(() => {
    const current = this.status();
    return current ? describeSyncStatus(current) : '';
  });
  protected readonly tone = computed(() => {
    const current = this.status();
    return current ? SYNC_STATE_DISPLAY[current.state].tone : 'neutral';
  });
}
