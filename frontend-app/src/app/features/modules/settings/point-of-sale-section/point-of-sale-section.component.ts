import { Component, input, output } from '@angular/core';
import { DISCOUNT_TEXT_MAX_LENGTH } from '../../../../core/utils/pos-discount.util';
import {
  SettingsDraft,
  SettingsFieldErrors,
  SettingsFieldKey,
} from '../../../../core/utils/settings-validation.util';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';

const FIELD_ID_PREFIX = 'settings-';

type PercentKey = 'posDefaultDiscountPercent' | 'posMaxDiscountPercent';
type OptionKey = 'posLineDiscountEnabled' | 'posBillDiscountEnabled' | 'posHideSidebar';

@Component({
  selector: 'app-point-of-sale-section',
  imports: [...FIELD_IMPORTS],
  templateUrl: './point-of-sale-section.component.html',
  styleUrl: './point-of-sale-section.component.scss',
})
export class PointOfSaleSectionComponent {
  readonly draft = input.required<SettingsDraft>();
  readonly errors = input<SettingsFieldErrors>({});
  readonly disabled = input(false);
  readonly changed = output<Partial<SettingsDraft>>();

  protected readonly percentMaxLength = DISCOUNT_TEXT_MAX_LENGTH;
  protected readonly optionIdPrefix = FIELD_ID_PREFIX;

  protected fieldId(key: SettingsFieldKey): string {
    return `${FIELD_ID_PREFIX}${key}`;
  }

  protected error(key: SettingsFieldKey): string | null {
    return this.errors()[key] ?? null;
  }

  protected onPercentInput(key: PercentKey, event: Event): void {
    this.changed.emit({ [key]: (event.target as HTMLInputElement).value });
  }

  protected onOptionChange(key: OptionKey, event: Event): void {
    this.changed.emit({ [key]: (event.target as HTMLInputElement).checked });
  }
}
