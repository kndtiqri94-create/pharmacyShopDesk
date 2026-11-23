import { TestBed } from '@angular/core/testing';
import { LocalDbEvents } from './data/local/local-db-events.service';
import { ConnectivityService } from './connectivity.service';

describe('ConnectivityService', () => {
  function create() {
    const service = TestBed.inject(ConnectivityService);
    const seen: boolean[] = [];
    service.online$.subscribe(value => seen.push(value));
    return { service, seen };
  }

  afterEach(() => {
    window.dispatchEvent(new Event('online'));
    TestBed.resetTestingModule();
  });

  it('follows the browser online and offline events without any user action (AC-5)', () => {
    const { service, seen } = create();
    window.dispatchEvent(new Event('offline'));
    expect(service.isOnline()).toBeFalse();
    expect(service.canAttempt()).toBeFalse();
    window.dispatchEvent(new Event('online'));
    expect(service.isOnline()).toBeTrue();
    expect(seen).toEqual([true, false, true]);
  });

  it('drops to offline when a request fails at network level and recovers on the next success', () => {
    const { service } = create();
    service.reportNetworkFailure();
    expect(service.isOnline()).toBeFalse();
    expect(service.canAttempt()).toBeTrue();
    service.reportSuccess();
    expect(service.isOnline()).toBeTrue();
  });

  it('records only a code and a flag for each change, never a payload', () => {
    const { service } = create();
    service.reportNetworkFailure();
    service.reportSuccess();
    const events = TestBed.inject(LocalDbEvents)
      .list()
      .filter(event => event.code === 'connectivity.changed');
    expect(events.map(event => event.detail)).toEqual([0, 1]);
  });

  it('stops listening once destroyed', () => {
    const { service } = create();
    service.ngOnDestroy();
    window.dispatchEvent(new Event('offline'));
    expect(service.isOnline()).toBeTrue();
  });
});
