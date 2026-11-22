import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

@Injectable()
export class PosFullscreenService {
  private readonly document = inject(DOCUMENT);
  private readonly activeSignal = signal(this.document.fullscreenElement !== null);

  readonly supported =
    this.document.fullscreenEnabled === true &&
    typeof this.document.documentElement.requestFullscreen === 'function';
  readonly isFullscreen = this.activeSignal.asReadonly();

  constructor() {
    const syncState = () => this.activeSignal.set(this.document.fullscreenElement !== null);
    this.document.addEventListener('fullscreenchange', syncState);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('fullscreenchange', syncState);
      this.leave().catch(() => undefined);
    });
  }

  async toggle(): Promise<void> {
    if (!this.supported) return;
    try {
      if (this.document.fullscreenElement === null) {
        await this.document.documentElement.requestFullscreen();
      } else {
        await this.document.exitFullscreen();
      }
    } catch {
      this.activeSignal.set(this.document.fullscreenElement !== null);
    }
  }

  private async leave(): Promise<void> {
    if (this.supported && this.document.fullscreenElement !== null) {
      await this.document.exitFullscreen();
    }
  }
}
