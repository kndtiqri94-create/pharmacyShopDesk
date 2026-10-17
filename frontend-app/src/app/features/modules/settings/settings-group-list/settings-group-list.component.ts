import { Component, input, output } from '@angular/core';
import { SETTINGS_GROUPS, SettingsGroupId } from '../../../../core/utils/settings-validation.util';

@Component({
  selector: 'app-settings-group-list',
  templateUrl: './settings-group-list.component.html',
  styleUrl: './settings-group-list.component.scss',
})
export class SettingsGroupListComponent {
  readonly active = input.required<SettingsGroupId>();
  readonly selected = output<SettingsGroupId>();

  protected readonly groups = SETTINGS_GROUPS;
}
