export const SyncState = {
  ONLINE: 'ONLINE',
  SYNCING: 'SYNCING',
  OFFLINE: 'OFFLINE',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
} as const;

export type SyncState = (typeof SyncState)[keyof typeof SyncState];
