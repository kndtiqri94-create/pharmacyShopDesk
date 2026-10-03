import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';

export const SAMPLE_TODAY = '2026-09-21';

@Injectable({ providedIn: 'root' })
export class ClockService {
  today(): string {
    return environment.useMockData ? SAMPLE_TODAY : new Date().toISOString().slice(0, 10);
  }
}
