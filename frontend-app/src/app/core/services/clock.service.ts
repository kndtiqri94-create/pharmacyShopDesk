import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';

export const SAMPLE_TODAY = '2026-09-21';

@Injectable({ providedIn: 'root' })
export class ClockService {
  today(): string {
    return environment.useMockData ? SAMPLE_TODAY : new Date().toISOString().slice(0, 10);
  }

  now(): string {
    const time = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${this.today()}T${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  }
}
