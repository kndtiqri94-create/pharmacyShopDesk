import { Injectable, signal } from '@angular/core';

export type NotificationTone = 'info' | 'success' | 'warning';

export interface AppNotification {
  id: number;
  tone: NotificationTone;
  message: string;
}

export const NOTIFICATION_DISMISS_MS = 6000;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly currentSignal = signal<AppNotification | null>(null);
  readonly current = this.currentSignal.asReadonly();
  private nextId = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(tone: NotificationTone, message: string): void {
    this.clearTimer();
    this.currentSignal.set({ id: this.nextId, tone, message });
    this.nextId += 1;
    this.timer = setTimeout(() => this.dismiss(), NOTIFICATION_DISMISS_MS);
  }

  showSampleOnly(feature: string): void {
    this.show('info', `${feature} is sample only for now and does nothing yet.`);
  }

  dismiss(): void {
    this.clearTimer();
    this.currentSignal.set(null);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
