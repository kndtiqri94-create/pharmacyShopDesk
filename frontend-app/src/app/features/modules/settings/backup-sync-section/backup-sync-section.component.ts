import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { SyncActionResult } from '../../../../core/models/domain/sync-action-result.model';
import { SyncState } from '../../../../core/models/enums/sync-state.enum';
import { SyncDataService } from '../../../../core/services/data/sync-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  DATA_LOSS_NOTE,
  SyncMessage,
  describeBackUpNow,
  describeLastError,
  describeSyncNow,
  formatSyncTime,
} from '../../../../core/utils/sync-text.util';
import { AlertComponent, AlertTone } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { NeedsAttentionListComponent } from './needs-attention-list/needs-attention-list.component';

@Component({
  selector: 'app-backup-sync-section',
  imports: [AlertComponent, ButtonComponent, NeedsAttentionListComponent, ToggleComponent],
  templateUrl: './backup-sync-section.component.html',
  styleUrl: './backup-sync-section.component.scss',
})
export class BackupSyncSectionComponent {
  readonly autoSync = input.required<boolean>();
  readonly disabled = input(false);
  readonly autoSyncChanged = output<boolean>();

  private readonly notificationService = inject(NotificationService);
  private readonly syncDataService = inject(SyncDataService);

  protected readonly status = toSignal(this.syncDataService.status$);
  protected readonly attentionItems = toSignal(this.syncDataService.attentionItems$, {
    initialValue: [],
  });
  protected readonly busy = signal(false);
  protected readonly dataLossNote = DATA_LOSS_NOTE;
  protected readonly lastSync = computed(() => formatSyncTime(this.status()?.lastSyncAt ?? null));
  protected readonly pending = computed(() => this.status()?.pendingChanges ?? 0);
  protected readonly errorText = computed(() => {
    const current = this.status();
    return current ? describeLastError(current) : null;
  });
  protected readonly summary = computed<{ tone: AlertTone; text: string }>(() => {
    const current = this.status();
    if (!current) return { tone: 'info', text: 'Checking the sync state.' };
    if (current.state === SyncState.NEEDS_ATTENTION) {
      return { tone: 'warning', text: 'Some changes were refused. See Needs attention below.' };
    }
    if (current.state === SyncState.OFFLINE) {
      return { tone: 'warning', text: 'You are offline. Changes are saved on this device.' };
    }
    if (current.pendingChanges > 0) {
      return { tone: 'info', text: 'Changes are saved here and waiting to be sent.' };
    }
    return { tone: 'success', text: 'Everything is saved on the central record.' };
  });

  protected syncNow(): void {
    this.perform(this.syncDataService.syncNow(), describeSyncNow).catch(() => undefined);
  }

  protected backUpNow(): void {
    this.perform(this.syncDataService.backUpNow(), describeBackUpNow).catch(() => undefined);
  }

  private async perform(
    action: ReturnType<SyncDataService['syncNow']>,
    describe: (result: SyncActionResult) => SyncMessage
  ): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const message = describe(await firstValueFrom(action));
      this.notificationService.show(message.tone, message.text);
    } finally {
      this.busy.set(false);
    }
  }
}
