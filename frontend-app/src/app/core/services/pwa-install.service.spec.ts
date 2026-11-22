import { TestBed } from '@angular/core/testing';
import { PwaInstallService } from './pwa-install.service';

function installPromptEvent() {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = jasmine.createSpy('prompt').and.resolveTo();
  Object.assign(event, { prompt });
  return { event, prompt };
}

describe('PwaInstallService', () => {
  it('cannot install until the browser offers it', () => {
    expect(TestBed.inject(PwaInstallService).canInstall()).toBe(false);
  });

  it('captures the install prompt and suppresses the browser mini-infobar', () => {
    const service = TestBed.inject(PwaInstallService);
    const { event } = installPromptEvent();
    window.dispatchEvent(event);
    expect(service.canInstall()).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('shows the browser prompt on install and then hides the option', async () => {
    const service = TestBed.inject(PwaInstallService);
    const { event, prompt } = installPromptEvent();
    window.dispatchEvent(event);
    await service.install();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(service.canInstall()).toBe(false);
  });

  it('hides the option once the app is installed', () => {
    const service = TestBed.inject(PwaInstallService);
    window.dispatchEvent(installPromptEvent().event);
    window.dispatchEvent(new Event('appinstalled'));
    expect(service.canInstall()).toBe(false);
  });

  it('does nothing on install when no prompt was captured', async () => {
    await expectAsync(TestBed.inject(PwaInstallService).install()).toBeResolved();
  });
});
