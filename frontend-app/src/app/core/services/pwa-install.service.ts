import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly document = inject(DOCUMENT);
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly canInstallSignal = signal(false);
  readonly canInstall = this.canInstallSignal.asReadonly();

  constructor() {
    const view = this.document.defaultView;
    if (!view) {
      return;
    }
    view.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.canInstallSignal.set(true);
    });
    view.addEventListener('appinstalled', () => this.clear());
  }

  async install(): Promise<void> {
    const promptEvent = this.deferredPrompt;
    if (!promptEvent) {
      return;
    }
    this.clear();
    await promptEvent.prompt();
  }

  private clear(): void {
    this.deferredPrompt = null;
    this.canInstallSignal.set(false);
  }
}
