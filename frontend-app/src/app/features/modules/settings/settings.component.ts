import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppSettings } from '../../../core/models/domain/app-settings.model';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { SettingsDataService } from '../../../core/services/data/settings-data.service';
import { SyncDataService } from '../../../core/services/data/sync-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { SettingsService } from '../../../core/services/settings.service';
import { isSettingsDirty, toDraft } from '../../../core/utils/settings-diff.util';
import {
  SETTINGS_FIELD_GROUP,
  SETTINGS_GROUPS,
  SettingsDraft,
  SettingsFieldErrors,
  SettingsFieldKey,
  SettingsGroupId,
} from '../../../core/utils/settings-validation.util';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { BackupSyncSectionComponent } from './backup-sync-section/backup-sync-section.component';
import { CurrencyRegionSectionComponent } from './currency-region-section/currency-region-section.component';
import { InventoryAlertsSectionComponent } from './inventory-alerts-section/inventory-alerts-section.component';
import { SettingsGroupListComponent } from './settings-group-list/settings-group-list.component';
import { ShopProfileSectionComponent } from './shop-profile-section/shop-profile-section.component';

@Component({
  selector: 'app-settings',
  imports: [
    BackupSyncSectionComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    CurrencyRegionSectionComponent,
    InventoryAlertsSectionComponent,
    PageHeaderComponent,
    SettingsGroupListComponent,
    ShopProfileSectionComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly settingsDataService = inject(SettingsDataService);
  private readonly settingsService = inject(SettingsService);
  private readonly syncDataService = inject(SyncDataService);

  protected readonly moduleKey = ModuleKey.SETTINGS;
  protected readonly activeGroup = signal<SettingsGroupId>('shop-profile');
  protected readonly errors = signal<SettingsFieldErrors>({});
  protected readonly saving = signal(false);
  protected readonly autoSync = signal(true);
  protected readonly draft = signal<SettingsDraft | null>(null);

  private readonly saved = signal<AppSettings | null>(null);

  protected readonly canWrite = computed(() => this.permissionService.canWrite(this.moduleKey));
  protected readonly dirty = computed(() => {
    const draft = this.draft();
    const saved = this.saved();
    return draft !== null && saved !== null && isSettingsDirty(draft, saved);
  });
  protected readonly activeLabel = computed(
    () => SETTINGS_GROUPS.find(group => group.id === this.activeGroup())?.label ?? ''
  );

  ngOnInit(): void {
    this.load().catch(() => undefined);
  }

  protected selectGroup(group: SettingsGroupId): void {
    this.activeGroup.set(group);
  }

  protected edit(patch: Partial<SettingsDraft>): void {
    const current = this.draft();
    if (current === null || !this.canWrite()) return;
    this.draft.set({ ...current, ...patch });
    const remaining = { ...this.errors() };
    for (const key of Object.keys(patch) as SettingsFieldKey[]) delete remaining[key];
    this.errors.set(remaining);
  }

  protected discard(): void {
    const saved = this.saved();
    if (saved === null) return;
    this.draft.set(toDraft(saved));
    this.errors.set({});
  }

  protected save(): void {
    this.persist().catch(() => undefined);
  }

  protected changeAutoSync(enabled: boolean): void {
    this.applyAutoSync(enabled).catch(() => undefined);
  }

  private async applyAutoSync(enabled: boolean): Promise<void> {
    const result = await this.settingsService.setAutoSync(enabled);
    if (!result.ok) {
      this.notificationService.show(
        'warning',
        'That change was not made. You may not have access.'
      );
      return;
    }
    this.autoSync.set(result.enabled);
    this.notificationService.show(
      'success',
      result.enabled ? 'Automatic sync is on.' : 'Automatic sync is off.'
    );
  }

  private async persist(): Promise<void> {
    const draft = this.draft();
    if (draft === null || !this.dirty() || this.saving() || !this.canWrite()) return;
    this.saving.set(true);
    try {
      const result = await this.settingsService.save(draft);
      if (result.ok) {
        this.saved.set(result.settings);
        this.draft.set(toDraft(result.settings));
        this.errors.set({});
        this.notificationService.show(
          'success',
          'Settings saved. They apply across ShopDesk straight away.'
        );
        return;
      }
      this.errors.set(result.errors);
      if (result.reason === 'invalid') this.focusField(result.firstErrorField);
      else if (result.reason === 'denied') {
        this.notificationService.show(
          'warning',
          'Settings were not saved. You may not have access to change settings.'
        );
      }
    } finally {
      this.saving.set(false);
    }
  }

  private focusField(key: SettingsFieldKey | null): void {
    if (key === null) return;
    const group = SETTINGS_FIELD_GROUP[key];
    const focus = () =>
      this.hostElement.nativeElement.querySelector<HTMLElement>(`#settings-${key}`)?.focus();
    if (this.activeGroup() === group) {
      focus();
      return;
    }
    this.activeGroup.set(group);
    afterNextRender(focus, { injector: this.injector });
  }

  private async load(): Promise<void> {
    const [settings, status] = await Promise.all([
      firstValueFrom(this.settingsDataService.get()),
      firstValueFrom(this.syncDataService.getStatus()),
    ]);
    this.saved.set(settings);
    this.draft.set(toDraft(settings));
    this.autoSync.set(status.autoSyncEnabled);
  }
}
