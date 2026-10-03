import { Injectable, signal } from '@angular/core';
import { DRAWER_MEDIA_QUERY } from '../utils/breakpoints.const';

@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly drawerModeSignal = signal(false);
  readonly isDrawerMode = this.drawerModeSignal.asReadonly();

  constructor() {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(DRAWER_MEDIA_QUERY);
    this.drawerModeSignal.set(query.matches);
    query.addEventListener('change', event => this.drawerModeSignal.set(event.matches));
  }
}
