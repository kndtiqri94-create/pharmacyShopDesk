import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL, REQUIRE_HTTPS } from '../../../api-config';
import { PushChange } from './sync-transport.model';
import {
  SyncTransportService,
  isValidPullResponse,
  isValidPushResponse,
} from './sync-transport.service';

const CHANGE: PushChange = { changeId: 'c1', entity: 'suppliers', op: 'put', id: 's1', data: {} };

describe('SyncTransportService', () => {
  let controller: HttpTestingController;

  function setup(baseUrl = 'https://api.example.test/api/v1', requireHttps = true) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: baseUrl },
        { provide: REQUIRE_HTTPS, useValue: requireHttps },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
    return TestBed.inject(SyncTransportService);
  }

  async function failureFor(status: number, headers: Record<string, string> = {}) {
    TestBed.resetTestingModule();
    const transport = setup();
    const pending = transport.push('AB1', [CHANGE]);
    controller.expectOne(() => true).flush('x', { status, statusText: 'x', headers });
    return pending;
  }

  it('posts the batch with no custom headers, so the central record needs no extra CORS allowance', async () => {
    const transport = setup();
    const pending = transport.push('AB1', [CHANGE]);
    const request = controller.expectOne('https://api.example.test/api/v1/sync/push');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('X-Request-Id')).toBeFalse();
    expect(request.request.body).toEqual({ deviceCode: 'AB1', changes: [CHANGE] });
    request.flush({ results: [{ changeId: 'c1', status: 'accepted', message: 'dropped' }] });
    expect(await pending).toEqual({
      kind: 'ok',
      body: [{ changeId: 'c1', status: 'accepted', reason: undefined }],
    });
  });

  it('asks for a page of changes after a cursor', async () => {
    const transport = setup();
    const pending = transport.pull(12);
    const request = controller.expectOne(candidate => candidate.url.endsWith('/sync/pull'));
    expect(request.request.params.get('cursor')).toBe('12');
    expect(request.request.params.get('limit')).toBe('500');
    request.flush({ changes: [], nextCursor: 12, hasMore: false });
    expect((await pending).kind).toBe('ok');
  });

  it('treats 401 as unauthorised, never as a rejection', async () => {
    expect(await failureFor(401)).toEqual(jasmine.objectContaining({ failure: 'unauthorised' }));
  });

  it('treats 5xx and 429 as temporary, and keeps the retry-after hint', async () => {
    expect(await failureFor(500)).toEqual(jasmine.objectContaining({ failure: 'transient' }));
    expect(await failureFor(503)).toEqual(jasmine.objectContaining({ failure: 'transient' }));
    expect(await failureFor(429, { 'Retry-After': '12' })).toEqual(
      jasmine.objectContaining({ failure: 'transient', retryAfterMs: 12000 })
    );
  });

  it('treats other client errors as fatal and flags a lost connection as a network failure', async () => {
    expect(await failureFor(400)).toEqual(jasmine.objectContaining({ failure: 'fatal' }));
    expect(await failureFor(413)).toEqual(jasmine.objectContaining({ failure: 'fatal' }));
    TestBed.resetTestingModule();
    const transport = setup();
    const pending = transport.push('AB1', [CHANGE]);
    controller.expectOne(() => true).error(new ProgressEvent('error'), { status: 0 });
    expect(await pending).toEqual(
      jasmine.objectContaining({ failure: 'transient', network: true })
    );
  });

  it('refuses to talk over plain http when https is required', async () => {
    const transport = setup('http://api.example.test/api/v1', true);
    expect(await transport.push('AB1', [CHANGE])).toEqual(
      jasmine.objectContaining({ kind: 'failed', failure: 'fatal' })
    );
    controller.expectNone(() => true);
  });

  it('checks the shape of a push answer', () => {
    const accepted = { results: [{ changeId: 'c1', status: 'accepted' }] };
    expect(isValidPushResponse(accepted, [CHANGE])).toBeTrue();
    expect(isValidPushResponse({ results: [] }, [CHANGE])).toBeFalse();
    expect(
      isValidPushResponse({ results: [{ changeId: 'x', status: 'accepted' }] }, [CHANGE])
    ).toBeFalse();
    expect(
      isValidPushResponse({ results: [{ changeId: 'c1', status: 'weird' }] }, [CHANGE])
    ).toBeFalse();
    expect(isValidPushResponse('html', [CHANGE])).toBeFalse();
    expect(isValidPushResponse(null, [CHANGE])).toBeFalse();
  });

  it('checks the shape and size of a pull answer', () => {
    const change = { entity: 'suppliers', id: 's1', op: 'put', seq: 1, data: {} };
    const page = (changes: object[], cursor: unknown = 1) => ({
      changes,
      nextCursor: cursor,
      hasMore: false,
    });
    expect(isValidPullResponse(page([change]), 5)).toBeTrue();
    expect(isValidPullResponse(page([change, change]), 1)).toBeFalse();
    expect(isValidPullResponse(page([{ ...change, op: 'drop' }]), 5)).toBeFalse();
    expect(isValidPullResponse(page([], '1'), 5)).toBeFalse();
    expect(isValidPullResponse({ changes: [], nextCursor: 1 }, 5)).toBeFalse();
  });
});
