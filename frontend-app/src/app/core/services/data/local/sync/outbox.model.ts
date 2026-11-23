export type OutboxOperation = 'put' | 'delete';
export type OutboxStatus = 'pending' | 'rejected';

export interface OutboxEntry {
  seq?: number;
  changeId: string;
  entity: string;
  id: string;
  op: OutboxOperation;
  data: unknown;
  createdAt: string;
  status: OutboxStatus;
  reason?: string;
  attempts: number;
}

export interface SyncSeqRow {
  key: string;
  seq: number;
  awaiting?: boolean;
}

export function changeKey(entity: string, id: string): string {
  return `${entity}:${id}`;
}
