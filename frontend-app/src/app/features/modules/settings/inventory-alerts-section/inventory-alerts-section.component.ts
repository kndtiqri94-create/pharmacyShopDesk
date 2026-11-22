import { Component, input, output } from '@angular/core';
import {
  SETTINGS_NUMBER_MAX_LENGTH,
  SettingsDraft,
  SettingsFieldErrors,
  SettingsFieldKey,
} from '../../../../core/utils/settings-validation.util';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';

const FIELD_ID_PREFIX = 'settings-';

type NumberKey = 'expiryAlertDays' | 'defaultReorderLevel' | 'lowFloatRupees';
type OptionKey = 'sellEarliestExpiringFirst' | 'blockExpiredSales' | 'showLowStockCountInSidebar';

@Component({
  selector: 'app-inventory-alerts-section',
  imports: [...FIELD_IMPORTS],
  templateUrl: './inventory-alerts-section.component.html',
  styleUrl: './inventory-alerts-section.component.scss',
})
export class InventoryAlertsSectionComponent {
  readonly draft = input.required<SettingsDraft>();
  readonly errors = input<SettingsFieldErrors>({});
  readonly disabled = input(false);
  readonly changed = output<Partial<SettingsDraft>>();

  protected readonly numberMaxLength = SETTINGS_NUMBER_MAX_LENGTH;
  protected readonly optionIdPrefix = FIELD_ID_PREFIX;

  protected fieldId(key: SettingsFieldKey): string {
    return `${FIELD_ID_PREFIX}${key}`;
  }

  protected error(key: SettingsFieldKey): string | null {
    return this.errors()[key] ?? null;
  }

  protected onNumberInput(key: NumberKey, event: Event): void {
    this.changed.emit({ [key]: (event.target as HTMLInputElement).value });
  }

  protected onOptionChange(key: OptionKey, event: Event): void {
    this.changed.emit({ [key]: (event.target as HTMLInputElement).checked });
  }
}
