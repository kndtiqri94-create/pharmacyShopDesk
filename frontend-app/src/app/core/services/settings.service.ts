import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppSettings } from '../models/domain/app-settings.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { fromDraft } from '../utils/settings-diff.util';
import {
  SettingsDraft,
  SettingsFieldErrors,
  SettingsFieldKey,
  validateSettings,
} from '../utils/settings-validation.util';
import { AuthService } from './auth/auth.service';
import { SettingsDataService } from './data/settings-data.service';
import { SyncDataService } from './data/sync-data.service';
import { PermissionService } from './permission.service';

export type SettingsFailure = 'denied' | 'busy' | 'invalid';

export type SettingsSaveResult =
  | { ok: true; settings: AppSettings }
  | {
      ok: false;
      reason: SettingsFailure;
      errors: SettingsFieldErrors;
      firstErrorField: SettingsFieldKey | null;
    };

export type AutoSyncResult = { ok: true; enabled: boolean } | { ok: false; reason: 'denied' };

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly settingsDataService = inject(SettingsDataService);
  private readonly syncDataService = inject(SyncDataService);
  private readonly changeCount = signal(0);
  private busy = false;

  readonly changed = this.changeCount.asReadonly();

  async save(draft: SettingsDraft): Promise<SettingsSaveResult> {
    if (!this.canChange()) return this.failure('denied');
    if (this.busy) return this.failure('busy');
    this.busy = true;
    try {
      const result = validateSettings(draft);
      if (result.values === null) {
        return {
          ok: false,
          reason: 'invalid',
          errors: result.errors,
          firstErrorField: result.firstErrorField,
        };
      }
      const current = await firstValueFrom(this.settingsDataService.get());
      const saved = await firstValueFrom(
        this.settingsDataService.save(fromDraft(result.values, current))
      );
      this.changeCount.update(count => count + 1);
      return { ok: true, settings: saved };
    } finally {
      this.busy = false;
    }
  }

  async setAutoSync(enabled: boolean): Promise<AutoSyncResult> {
    if (!this.canChange()) return { ok: false, reason: 'denied' };
    const status = await firstValueFrom(this.syncDataService.getStatus());
    const saved = await firstValueFrom(
      this.syncDataService.setStatus({ ...status, autoSyncEnabled: enabled })
    );
    return { ok: true, enabled: saved.autoSyncEnabled };
  }

  private canChange(): boolean {
    return (
      this.authService.currentUser() !== null && this.permissionService.canWrite(ModuleKey.SETTINGS)
    );
  }

  private failure(reason: SettingsFailure): SettingsSaveResult {
    return { ok: false, reason, errors: {}, firstErrorField: null };
  }
}
