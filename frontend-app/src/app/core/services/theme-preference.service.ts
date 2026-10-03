import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { ThemePreference } from '../models/enums/theme-preference.enum';

export const THEME_STORAGE_KEY = 'shopdesk.theme';

function isThemePreference(value: unknown): value is ThemePreference {
  return value === ThemePreference.LIGHT || value === ThemePreference.DARK;
}

@Injectable({ providedIn: 'root' })
export class ThemePreferenceService {
  private readonly document = inject(DOCUMENT);
  private readonly preferenceSignal = signal<ThemePreference>(this.readStoredPreference());
  readonly preference = this.preferenceSignal.asReadonly();

  constructor() {
    this.apply(this.preferenceSignal());
  }

  set(value: unknown): void {
    const next = isThemePreference(value) ? value : ThemePreference.LIGHT;
    this.preferenceSignal.set(next);
    this.apply(next);
    this.persist(next);
  }

  toggle(): void {
    this.set(
      this.preferenceSignal() === ThemePreference.DARK
        ? ThemePreference.LIGHT
        : ThemePreference.DARK
    );
  }

  private readStoredPreference(): ThemePreference {
    try {
      const stored = sessionStorage.getItem(THEME_STORAGE_KEY);
      return isThemePreference(stored) ? stored : ThemePreference.LIGHT;
    } catch {
      return ThemePreference.LIGHT;
    }
  }

  private persist(value: ThemePreference): void {
    try {
      sessionStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      return;
    }
  }

  private apply(value: ThemePreference): void {
    this.document.documentElement.dataset['theme'] =
      value === ThemePreference.DARK ? 'dark' : 'light';
  }
}
