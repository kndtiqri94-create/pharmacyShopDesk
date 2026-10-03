export const ReloadStatus = {
  SUCCESS: 'SUCCESS',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
} as const;

export type ReloadStatus = (typeof ReloadStatus)[keyof typeof ReloadStatus];
