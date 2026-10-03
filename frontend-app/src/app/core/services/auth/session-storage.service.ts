import { Injectable } from '@angular/core';

export const SESSION_STORAGE_KEY = 'shopdesk.session';
const USER_ID_PATTERN = /^[a-z0-9-]{1,64}$/;

function isUserId(value: string | null): value is string {
  return value !== null && USER_ID_PATTERN.test(value);
}

@Injectable({ providedIn: 'root' })
export class SessionStorageService {
  read(): string | null {
    const fromSession = this.readFrom(() => sessionStorage);
    return fromSession ?? this.readFrom(() => localStorage);
  }

  write(userId: string, persistent: boolean): void {
    this.clear();
    try {
      (persistent ? localStorage : sessionStorage).setItem(SESSION_STORAGE_KEY, userId);
    } catch {
      return;
    }
  }

  clear(): void {
    for (const resolve of [() => sessionStorage, () => localStorage]) {
      try {
        resolve().removeItem(SESSION_STORAGE_KEY);
      } catch {
        continue;
      }
    }
  }

  private readFrom(resolve: () => Storage): string | null {
    try {
      const value = resolve().getItem(SESSION_STORAGE_KEY);
      return isUserId(value) ? value : null;
    } catch {
      return null;
    }
  }
}
