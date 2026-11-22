import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { PwaUpdateService } from './pwa-update.service';

function setup(isEnabled: boolean) {
  const versionUpdates = new Subject<VersionEvent>();
  const swUpdate = {
    isEnabled,
    versionUpdates,
    activateUpdate: jasmine.createSpy('activateUpdate').and.resolveTo(true),
  };
  TestBed.configureTestingModule({ providers: [{ provide: SwUpdate, useValue: swUpdate }] });
  return { service: TestBed.inject(PwaUpdateService), swUpdate, versionUpdates };
}

const readyEvent = { type: 'VERSION_READY' } as VersionEvent;

describe('PwaUpdateService', () => {
  it('starts with no update available', () => {
    expect(setup(true).service.updateAvailable()).toBe(false);
  });

  it('flags an update when a new version is ready and does not activate it', () => {
    const { service, versionUpdates, swUpdate } = setup(true);
    versionUpdates.next({ type: 'VERSION_DETECTED' } as VersionEvent);
    expect(service.updateAvailable()).toBe(false);
    versionUpdates.next(readyEvent);
    expect(service.updateAvailable()).toBe(true);
    expect(swUpdate.activateUpdate).not.toHaveBeenCalled();
  });

  it('clears the flag when dismissed without activating', () => {
    const { service, versionUpdates, swUpdate } = setup(true);
    versionUpdates.next(readyEvent);
    service.dismiss();
    expect(service.updateAvailable()).toBe(false);
    expect(swUpdate.activateUpdate).not.toHaveBeenCalled();
  });

  it('is a safe no-op when the service worker is disabled', async () => {
    const { service, versionUpdates, swUpdate } = setup(false);
    versionUpdates.next(readyEvent);
    expect(service.updateAvailable()).toBe(false);
    await service.applyUpdate();
    expect(swUpdate.activateUpdate).not.toHaveBeenCalled();
  });

  it('does nothing on apply when no update is ready', async () => {
    const { service, swUpdate } = setup(true);
    await service.applyUpdate();
    expect(swUpdate.activateUpdate).not.toHaveBeenCalled();
  });

  it('activates and reloads only when the user applies a ready update', async () => {
    const reload = jasmine.createSpy('reload');
    const { service, versionUpdates, swUpdate } = setup(true);
    (service as unknown as { document: { location: { reload: () => void } } }).document = {
      location: { reload },
    };
    versionUpdates.next(readyEvent);
    expect(reload).not.toHaveBeenCalled();
    await service.applyUpdate();
    expect(swUpdate.activateUpdate).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
