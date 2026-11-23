import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, REQUIRE_HTTPS } from '../../../api-config';
import {
  PULL_PAGE_SIZE,
  PullPage,
  PushChange,
  PushResult,
  PushStatus,
  TransportFailure,
  TransportOutcome,
} from './sync-transport.model';

const PUSH_STATUSES: readonly string[] = ['accepted', 'duplicate', 'rejected'];
const MILLIS_PER_SECOND = 1000;
const HTTP_UNAUTHORISED = 401;
const HTTP_TOO_MANY = 429;
const HTTP_SERVER_ERROR = 500;

function failed<T>(
  failure: TransportFailure,
  network = false,
  retryAfterMs = 0
): TransportOutcome<T> {
  return { kind: 'failed', failure, network, retryAfterMs };
}

function retryAfter(error: HttpErrorResponse): number {
  const seconds = Number(error.headers.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * MILLIS_PER_SECOND : 0;
}

function classify<T>(error: unknown): TransportOutcome<T> {
  if (!(error instanceof HttpErrorResponse)) return failed('transient', true);
  if (error.status === 0) return failed('transient', true);
  if (error.status === HTTP_UNAUTHORISED) return failed('unauthorised');
  if (error.status === HTTP_TOO_MANY) return failed('transient', false, retryAfter(error));
  if (error.status >= HTTP_SERVER_ERROR) return failed('transient');
  return failed('fatal');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidPushResponse(body: unknown, sent: readonly PushChange[]): boolean {
  if (!isPlainObject(body) || !Array.isArray(body['results'])) return false;
  const results = body['results'] as unknown[];
  if (results.length !== sent.length) return false;
  return results.every(
    (result, index) =>
      isPlainObject(result) &&
      result['changeId'] === sent[index].changeId &&
      typeof result['status'] === 'string' &&
      PUSH_STATUSES.includes(result['status'])
  );
}

function isValidPulledChange(change: unknown): boolean {
  if (!isPlainObject(change)) return false;
  return (
    typeof change['entity'] === 'string' &&
    typeof change['id'] === 'string' &&
    (change['op'] === 'put' || change['op'] === 'delete') &&
    typeof change['seq'] === 'number'
  );
}

export function isValidPullResponse(body: unknown, limit: number): boolean {
  if (!isPlainObject(body) || !Array.isArray(body['changes'])) return false;
  const changes = body['changes'] as unknown[];
  return (
    changes.length <= limit &&
    typeof body['nextCursor'] === 'number' &&
    typeof body['hasMore'] === 'boolean' &&
    changes.every(isValidPulledChange)
  );
}

@Injectable({ providedIn: 'root' })
export class SyncTransportService {
  private readonly httpClient = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly requireHttps = inject(REQUIRE_HTTPS);

  async push(
    deviceCode: string,
    changes: readonly PushChange[]
  ): Promise<TransportOutcome<PushResult[]>> {
    if (this.insecure()) return failed('fatal');
    try {
      const body = await firstValueFrom(
        this.httpClient.post<unknown>(`${this.baseUrl}/sync/push`, { deviceCode, changes })
      );
      if (!isValidPushResponse(body, changes)) return failed('transient');
      const results = (body as { results: PushResult[] }).results.map(result => ({
        changeId: result.changeId,
        status: result.status as PushStatus,
        reason: typeof result.reason === 'string' ? result.reason : undefined,
      }));
      return { kind: 'ok', body: results };
    } catch (error) {
      return classify(error);
    }
  }

  async pull(cursor: number, limit: number = PULL_PAGE_SIZE): Promise<TransportOutcome<PullPage>> {
    if (this.insecure()) return failed('fatal');
    try {
      const body = await firstValueFrom(
        this.httpClient.get<unknown>(`${this.baseUrl}/sync/pull`, { params: { cursor, limit } })
      );
      if (!isValidPullResponse(body, limit)) return failed('transient');
      return { kind: 'ok', body: body as PullPage };
    } catch (error) {
      return classify(error);
    }
  }

  private insecure(): boolean {
    return this.requireHttps && !this.baseUrl.startsWith('https://');
  }
}
