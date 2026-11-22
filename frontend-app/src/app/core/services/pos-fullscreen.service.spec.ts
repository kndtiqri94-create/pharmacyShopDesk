import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { PosFullscreenService } from './pos-fullscreen.service';

interface FakeDocument {
  fullscreenEnabled: boolean;
  fullscreenElement: Element | null;
  documentElement: { requestFullscreen: jasmine.Spy | undefined };
  exitFullscreen: jasmine.Spy;
  listeners: Map<string, Set<() => void>>;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  fire(type: string): void;
}

function fakeDocument(enabled: boolean, withRequest = true): FakeDocument {
  const listeners = new Map<string, Set<() => void>>();
  const doc: FakeDocument = {
    fullscreenEnabled: enabled,
    fullscreenElement: null,
    documentElement: { requestFullscreen: undefined },
    exitFullscreen: jasmine.createSpy('exitFullscreen'),
    listeners,
    addEventListener: (type, listener) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
    },
    removeEventListener: (type, listener) => listeners.get(type)?.delete(listener),
    fire: type => listeners.get(type)?.forEach(listener => listener()),
  };
  if (withRequest) {
    doc.documentElement.requestFullscreen = jasmine
      .createSpy('requestFullscreen')
      .and.callFake(() => {
        doc.fullscreenElement = {} as Element;
        return Promise.resolve();
      });
  }
  doc.exitFullscreen.and.callFake(() => {
    doc.fullscreenElement = null;
    return Promise.resolve();
  });
  return doc;
}

describe('PosFullscreenService', () => {
  function create(doc: FakeDocument) {
    TestBed.configureTestingModule({
      providers: [PosFullscreenService, { provide: DOCUMENT, useValue: doc }],
    });
    return TestBed.inject(PosFullscreenService);
  }

  it('does not go full screen on its own', () => {
    const doc = fakeDocument(true);
    const service = create(doc);
    expect(service.supported).toBeTrue();
    expect(service.isFullscreen()).toBeFalse();
    expect(doc.documentElement.requestFullscreen).not.toHaveBeenCalled();
  });

  it('enters full screen only when toggled and follows the change event', async () => {
    const doc = fakeDocument(true);
    const service = create(doc);
    await service.toggle();
    doc.fire('fullscreenchange');
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(service.isFullscreen()).toBeTrue();
  });

  it('leaves full screen when toggled again', async () => {
    const doc = fakeDocument(true);
    const service = create(doc);
    await service.toggle();
    doc.fire('fullscreenchange');
    await service.toggle();
    doc.fire('fullscreenchange');
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(service.isFullscreen()).toBeFalse();
  });

  it('shows the real state when full screen ends by Esc or F11 without a click', async () => {
    const doc = fakeDocument(true);
    const service = create(doc);
    await service.toggle();
    doc.fire('fullscreenchange');
    expect(service.isFullscreen()).toBeTrue();
    doc.fullscreenElement = null;
    doc.fire('fullscreenchange');
    expect(service.isFullscreen()).toBeFalse();
  });

  it('is not supported when the browser has no full screen', async () => {
    const disabled = create(fakeDocument(false));
    expect(disabled.supported).toBeFalse();
    await disabled.toggle();
    expect(disabled.isFullscreen()).toBeFalse();
  });

  it('is not supported when the browser cannot request full screen', () => {
    TestBed.resetTestingModule();
    expect(create(fakeDocument(true, false)).supported).toBeFalse();
  });

  it('keeps the real state when the browser refuses the request', async () => {
    const doc = fakeDocument(true);
    doc.documentElement.requestFullscreen!.and.callFake(() => Promise.reject(new Error('no')));
    const service = create(doc);
    await service.toggle();
    expect(service.isFullscreen()).toBeFalse();
  });

  it('stops listening and leaves full screen when the till closes', async () => {
    const doc = fakeDocument(true);
    const service = create(doc);
    await service.toggle();
    doc.fire('fullscreenchange');
    expect(service.isFullscreen()).toBeTrue();
    TestBed.resetTestingModule();
    await Promise.resolve();
    expect(doc.listeners.get('fullscreenchange')?.size).toBe(0);
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
  });
});
