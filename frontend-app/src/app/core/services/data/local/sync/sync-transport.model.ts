export type PushStatus = 'accepted' | 'duplicate' | 'rejected';

export interface PushChange {
  changeId: string;
  entity: string;
  op: 'put' | 'delete';
  id: string;
  data?: unknown;
  baseSeq?: number | null;
}

export interface PushResult {
  changeId: string;
  status: PushStatus;
  reason?: string;
}

export interface PulledChange {
  entity: string;
  id: string;
  op: 'put' | 'delete';
  seq: number;
  data: unknown;
}

export interface PullPage {
  changes: PulledChange[];
  nextCursor: number;
  hasMore: boolean;
}

export type TransportFailure = 'transient' | 'unauthorised' | 'fatal';

export type TransportOutcome<T> =
  | { kind: 'ok'; body: T }
  | { kind: 'failed'; failure: TransportFailure; network: boolean; retryAfterMs: number };

export const PUSH_BATCH_SIZE = 100;
export const PULL_PAGE_SIZE = 500;
