import { InjectionToken } from '@angular/core';
import { environment } from '@environments/environment';

export const MOCK_AUTH_ENABLED = new InjectionToken<boolean>('MOCK_AUTH_ENABLED', {
  providedIn: 'root',
  factory: () => environment.mockAuthEnabled,
});

export const SIGN_IN_THROTTLE_MS = new InjectionToken<number>('SIGN_IN_THROTTLE_MS', {
  providedIn: 'root',
  factory: () => 1500,
});

export const SIGN_IN_MAX_INPUT_LENGTH = 100;
export const SIGN_IN_FAILURE_THRESHOLD = 5;
