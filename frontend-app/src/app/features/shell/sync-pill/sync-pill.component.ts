import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SyncDataService } from '../../../core/services/data/sync-data.service';
import { SYNC_STATE_DISPLAY } from '../../../core/utils/status-display.util';
import { describeSyncStatus } from '../../../core/utils/sync-status.util';

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
