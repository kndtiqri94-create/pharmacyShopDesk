import { Component, computed, input } from '@angular/core';
import { initialsFromName } from '../../../core/utils/initials.util';

export { initialsFromName } from '../../../core/utils/initials.util';

export type AvatarSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly initials = input<string | null>(null);
  readonly size = input<AvatarSize>('md');

  protected readonly text = computed(() => this.initials() ?? initialsFromName(this.name()));
}
