import { Component, computed, input } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg';

export function initialsFromName(name: string): string {
  const words = name
    .trim()
    .split(' ')
    .filter(word => word.length > 0);
  const letters = words.slice(0, 2).map(word => word[0]);
  return letters.join('').toUpperCase();
}

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
