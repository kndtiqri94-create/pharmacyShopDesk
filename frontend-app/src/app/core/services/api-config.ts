import { InjectionToken } from '@angular/core';
import { environment } from '@environments/environment';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});

export const API_AUTH_TOKEN = new InjectionToken<string>('API_AUTH_TOKEN', {
  providedIn: 'root',
  factory: () => environment.apiAuthToken,
});

export const SYNC_INTERVAL_MS = new InjectionToken<number>('SYNC_INTERVAL_MS', {
  providedIn: 'root',
  factory: () => environment.syncIntervalMs,
});

export const REQUIRE_HTTPS = new InjectionToken<boolean>('REQUIRE_HTTPS', {
  providedIn: 'root',
  factory: () => environment.production,
});

const PLACEHOLDER_PATTERN = /^__[A-Z_]+__$/;

export function isUsableToken(token: string): boolean {
  return token.trim() !== '' && !PLACEHOLDER_PATTERN.test(token);
}
