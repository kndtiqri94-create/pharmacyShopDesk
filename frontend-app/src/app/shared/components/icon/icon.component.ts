import { Component, computed, input } from '@angular/core';
import { IconName, IconSize } from '../../../core/models/shared/icon-name.model';
import { ICON_PATHS } from './icon-paths';

@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<IconSize>(18);
  readonly label = input<string | null>(null);

  protected readonly paths = computed(() => ICON_PATHS[this.name()]);
}
