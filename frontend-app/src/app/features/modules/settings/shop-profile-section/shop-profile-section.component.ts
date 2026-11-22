import { Component, inject, input, output } from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  SETTINGS_TEXT_MAX_LENGTH,
  SettingsDraft,
  SettingsFieldErrors,
  SettingsFieldKey,
} from '../../../../core/utils/settings-validation.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';

const FIELD_ID_PREFIX = 'settings-';

@Component({
  selector: 'app-shop-profile-section',
  imports: [...FIELD_IMPORTS, ButtonComponent],
  templateUrl: './shop-profile-section.component.html',
  styleUrl: './shop-profile-section.component.scss',
})
export class ShopProfileSectionComponent {
  readonly draft = input.required<SettingsDraft>();
  readonly errors = input<SettingsFieldErrors>({});
  readonly disabled = input(false);
  readonly changed = output<Partial<SettingsDraft>>();

  private readonly notificationService = inject(NotificationService);

  protected readonly maxLength = SETTINGS_TEXT_MAX_LENGTH;

  protected fieldId(key: SettingsFieldKey): string {
    return `${FIELD_ID_PREFIX}${key}`;
  }

  protected error(key: SettingsFieldKey): string | null {
    return this.errors()[key] ?? null;
  }

  protected onInput(key: keyof typeof SETTINGS_TEXT_MAX_LENGTH, event: Event): void {
    this.changed.emit({ [key]: (event.target as HTMLInputElement).value });
  }

  protected showUploadMessage(): void {
    this.notificationService.showSampleOnly('Upload logo');
  }
}
