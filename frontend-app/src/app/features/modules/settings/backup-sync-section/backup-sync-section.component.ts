import { Component, inject, input, output } from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';

export const BACKUP_NOTICE =
  'Everything is backed up. Last sync today 09:12 · next automatic sync in 5 minutes.';

@Component({
  selector: 'app-backup-sync-section',
  imports: [AlertComponent, ButtonComponent, ToggleComponent],
  templateUrl: './backup-sync-section.component.html',
  styleUrl: './backup-sync-section.component.scss',
})
export class BackupSyncSectionComponent {
  readonly autoSync = input.required<boolean>();
  readonly disabled = input(false);
  readonly autoSyncChanged = output<boolean>();

  private readonly notificationService = inject(NotificationService);

  protected readonly notice = BACKUP_NOTICE;

  protected showSampleMessage(feature: string): void {
    this.notificationService.showSampleOnly(feature);
  }
}
