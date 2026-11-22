import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);
  private readonly updateAvailableSignal = signal(false);
  readonly updateAvailable = this.updateAvailableSignal.asReadonly();

  constructor() {
    if (!this.swUpdate.isEnabled) {
      return;
    }
    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.updateAvailableSignal.set(true));
  }

  dismiss(): void {
    this.updateAvailableSignal.set(false);
  }

  async applyUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled || !this.updateAvailableSignal()) {
      return;
    }
    await this.swUpdate.activateUpdate();
    this.document.location.reload();
  }
}
