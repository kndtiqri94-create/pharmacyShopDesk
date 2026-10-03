import { TestBed } from '@angular/core/testing';
import { clearBrowserStorage } from '../../../testing/auth-test.util';
import { ThemePreference } from '../models/enums/theme-preference.enum';
import { THEME_STORAGE_KEY, ThemePreferenceService } from './theme-preference.service';

describe('ThemePreferenceService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    delete document.documentElement.dataset['theme'];
  });

  afterEach(clearBrowserStorage);

  it('starts light when nothing is stored', () => {
    const service = TestBed.inject(ThemePreferenceService);
    expect(service.preference()).toBe(ThemePreference.LIGHT);
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('switches the whole app and keeps the choice for the session', () => {
    const service = TestBed.inject(ThemePreferenceService);
    service.toggle();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(sessionStorage.getItem(THEME_STORAGE_KEY)).toBe(ThemePreference.DARK);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('restores a stored dark choice', () => {
    sessionStorage.setItem(THEME_STORAGE_KEY, ThemePreference.DARK);
    TestBed.inject(ThemePreferenceService);
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('falls back to light for a tampered stored value', () => {
    sessionStorage.setItem(THEME_STORAGE_KEY, '"><script>alert(1)</script>');
    const service = TestBed.inject(ThemePreferenceService);
    expect(service.preference()).toBe(ThemePreference.LIGHT);
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('falls back to light when asked to set an invalid value', () => {
    const service = TestBed.inject(ThemePreferenceService);
    service.set(ThemePreference.DARK);
    service.set('purple');
    expect(service.preference()).toBe(ThemePreference.LIGHT);
  });
});
