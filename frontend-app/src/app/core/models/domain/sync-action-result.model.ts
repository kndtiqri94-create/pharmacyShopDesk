export type SyncActionOutcome = 'completed' | 'offline' | 'unauthorised' | 'failed' | 'busy';

export interface SyncActionResult {
  outcome: SyncActionOutcome;
  pendingChanges: number;
  attentionCount: number;
}
