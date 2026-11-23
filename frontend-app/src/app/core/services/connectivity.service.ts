import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LocalDbEvents } from './data/local/local-db-events.service';

@Injectable({ providedIn: 'root' })
export class ConnectivityService implements OnDestroy {
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly events = inject(LocalDbEvents);
  private deviceOnline = this.view?.navigator.onLine ?? true;
  private reachable = true;
  private readonly state = new BehaviorSubject<boolean>(this.deviceOnline);
  private readonly onlineListener = () => this.setDevice(true);
  private readonly offlineListener = () => this.setDevice(false);

  readonly online$: Observable<boolean> = this.state.asObservable();

  constructor() {
    this.view?.addEventListener('online', this.onlineListener);
    this.view?.addEventListener('offline', this.offlineListener);
  }

  isOnline(): boolean {
    return this.state.value;
  }

  canAttempt(): boolean {
    return this.deviceOnline;
  }

  reportNetworkFailure(): void {
    this.reachable = false;
    this.publish();
  }

  reportSuccess(): void {
    this.reachable = true;
    this.publish();
  }

  ngOnDestroy(): void {
    this.view?.removeEventListener('online', this.onlineListener);
    this.view?.removeEventListener('offline', this.offlineListener);
  }

  private setDevice(online: boolean): void {
    this.deviceOnline = online;
    if (online) this.reachable = true;
    this.publish();
  }

  private publish(): void {
    const next = this.deviceOnline && this.reachable;
    if (next === this.state.value) return;
    this.events.record('connectivity.changed', next ? 1 : 0);
    this.state.next(next);
  }
}
