import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PwaInstallService } from '../../../core/services/pwa-install.service';
import { PwaUpdateService } from '../../../core/services/pwa-update.service';
import { PwaNoticeComponent } from './pwa-notice.component';

function setup(updateAvailable: boolean, canInstall: boolean) {
  const update = {
    updateAvailable: signal(updateAvailable).asReadonly(),
    applyUpdate: jasmine.createSpy('applyUpdate').and.resolveTo(),
    dismiss: jasmine.createSpy('dismiss'),
  };
  const install = {
    canInstall: signal(canInstall).asReadonly(),
    install: jasmine.createSpy('install').and.resolveTo(),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: PwaUpdateService, useValue: update },
      { provide: PwaInstallService, useValue: install },
    ],
  });
  const fixture = TestBed.createComponent(PwaNoticeComponent);
  fixture.detectChanges();
  return { element: fixture.nativeElement as HTMLElement, update, install };
}

function clickButton(element: HTMLElement, label: string): void {
  const button = Array.from(element.querySelectorAll('button')).find(candidate =>
    candidate.textContent?.includes(label)
  );
  button?.click();
}

describe('PwaNoticeComponent', () => {
  it('shows nothing when there is no update and no install option', () => {
    const { element } = setup(false, false);
    expect(element.querySelector('[data-testid="pwa-update-notice"]')).toBeNull();
    expect(element.querySelector('[data-testid="pwa-install-notice"]')).toBeNull();
    expect(element.querySelector('output')).not.toBeNull();
  });

  it('shows the update notice without applying it automatically', () => {
    const { element, update } = setup(true, false);
    expect(element.querySelector('[data-testid="pwa-update-notice"]')).not.toBeNull();
    expect(update.applyUpdate).not.toHaveBeenCalled();
  });

  it('applies the update only when the user chooses Update now', () => {
    const { element, update } = setup(true, false);
    clickButton(element, 'Update now');
    expect(update.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('dismisses the notice with Not now without applying', () => {
    const { element, update } = setup(true, false);
    clickButton(element, 'Not now');
    expect(update.dismiss).toHaveBeenCalledTimes(1);
    expect(update.applyUpdate).not.toHaveBeenCalled();
  });

  it('shows the install option only when installing is possible and triggers it', () => {
    const { element, install } = setup(false, true);
    expect(element.querySelector('[data-testid="pwa-install-notice"]')).not.toBeNull();
    clickButton(element, 'Install ShopDesk');
    expect(install.install).toHaveBeenCalledTimes(1);
  });
});
