export const SyncState = {
  ONLINE: 'ONLINE',
  SYNCING: 'SYNCING',
  OFFLINE: 'OFFLINE',
} as const;

export type SyncState = (typeof SyncState)[keyof typeof SyncState];
